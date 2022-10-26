import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'
import {GitHub} from '@actions/github/lib/utils'
import {Action, PullRequest, TerraformPlan} from './types'
import {ExecOptions} from '@actions/exec'

export const noChangesComment = 'No changes detected'

async function run(): Promise<void> {
  try {
    core.debug('got inside the action')

    const pr = github.context.payload.pull_request
    if (!pr) {
      core.info('No pull request, exiting action...')
      return
    }
    core.debug('got pull request')

    const planFileName = core.getInput('terraform-plan-file')
    const workingDir = core.getInput('working-directory')
    const commentTitle = core.getInput('comment-title')

    const json = await jsonFromPlan(workingDir, planFileName)
    const terraformPlan: TerraformPlan = JSON.parse(json)
    core.debug('successfully parsed json')

    const token = core.getInput('github-token')
    const runId = parseInt(process.env['GITHUB_RUN_ID'] || '-1')
    if (runId === -1) {
      core.setFailed('No GITHUB_RUN_ID found')
      return
    }

    const commenter = new PlanCommenter({
      octokit: github.getOctokit(token),
      runId,
      pr,
      commentTitle
    })
    await commenter.commentWithPlanSummary(terraformPlan)
  } catch (error) {
    core.setFailed(error.message)
  }
}

// we need to parse the terraform plan into a json string
async function jsonFromPlan(workingDir: string, planFileName: string): Promise<string> {
  // run terraform show -json to parse the plan into a json string
  let output = ''
  const options: ExecOptions = {
    listeners: {
      stdout: (data: Buffer) => {
        // captures the standard output of the terraform show command and appends it to the variable 'output'
        output += data.toString('utf8')
      }
    },
    cwd: workingDir // execute the command from working directory 'dir'
  }

  core.debug(`execOptions: ${JSON.stringify(options)}`)
  await exec.exec('terraform', ['show', '-json', planFileName], options)

  // pull out any extra fluff from terraform wrapper from the hashicorp/setup-terraform action
  const json = output.match(/{.*}/)
  if (json === null) {
    core.error('null match...')
    core.debug('** start of  output **')
    core.debug(output)
    core.debug('** end of output **')
    throw Error("output didn't match with /{.*}/ correctly")
  }
  core.debug('** matched json **')
  core.debug(json[0])
  core.debug('** end matched json **')

  return json[0]
}

interface PlanCommenterOptions {
  octokit: InstanceType<typeof GitHub>
  runId: number
  pr: PullRequest
  commentTitle?: string | undefined
}

export class PlanCommenter {
  octokit: InstanceType<typeof GitHub>
  runId: number
  pr: PullRequest
  commentPrefix: string

  constructor(options: PlanCommenterOptions) {
    this.octokit = options.octokit
    this.runId = options.runId
    this.pr = options.pr
    this.commentPrefix =
      options.commentTitle === undefined ? '## Terraform Plan:' : `## ${options.commentTitle}:`
  }

  async commentWithPlanSummary(terraformPlan: TerraformPlan): Promise<number> {
    const body = await this.planSummaryBody(terraformPlan)
    // find previous comment if it exists
    const comments = await this.octokit.rest.issues.listComments({
      ...github.context.repo,
      issue_number: this.pr.number
    })
    let previousCommentId: number | null = null
    for (const comment of comments.data) {
      if (
        comment.user?.login === 'github-actions[bot]' &&
        comment.body?.startsWith(this.commentPrefix)
      ) {
        previousCommentId = comment.id
      }
    }
    if (previousCommentId) {
      // update the previous comment
      const updatedComment = await this.octokit.rest.issues.updateComment({
        ...github.context.repo,
        issue_number: this.pr.number,
        comment_id: previousCommentId,
        body
      })
      core.info(`Updated existing comment: ${updatedComment.data.html_url}`)
      return updatedComment.data.id
    } else {
      // create new comment if previous comment does not exist
      const createdComment = await this.octokit.rest.issues.createComment({
        ...github.context.repo,
        issue_number: this.pr.number,
        body
      })
      core.info(`Created comment: ${createdComment.data.html_url}`)
      return createdComment.data.id
    }
  }

  async planSummaryBody(terraformPlan: TerraformPlan): Promise<string> {
    const toCreate = []
    const toDelete = []
    const toReplace = []
    const toUpdate = []
    if (!terraformPlan.resource_changes) {
      return `${this.commentPrefix}\n${noChangesComment}`
    }

    for (const resourceChange of terraformPlan.resource_changes) {
      const actions = resourceChange.change.actions
      const resourceName = `${resourceChange.type} - ${resourceChange.name}`
      core.debug(`  resource: ${resourceName}, actions: ${actions}`)
      if (actions.length === 1 && actions.includes(Action.create)) {
        toCreate.push(resourceName)
      } else if (actions.length === 1 && actions.includes(Action.delete)) {
        toDelete.push(resourceName)
      } else if (
        actions.length === 2 &&
        actions.includes(Action.delete) &&
        actions.includes(Action.create)
      ) {
        toReplace.push(resourceName)
      } else if (actions.length === 1 && actions.includes(Action.update)) {
        toUpdate.push(resourceName)
      } else if (!actions.includes(Action['no-op'])) {
        core.debug(`Not found? ${actions}`)
      }
    }

    core.debug(`toCreate: ${toCreate}`)
    core.debug(`toUpdate: ${toUpdate}`)
    core.debug(`toReplace: ${toReplace}`)
    core.debug(`toDelete: ${toDelete}`)

    let body = `${this.commentPrefix}\n`
    body += PlanCommenter.resourcesToChangeSection('create', toCreate)
    body += PlanCommenter.resourcesToChangeSection('update', toUpdate)
    body += PlanCommenter.resourcesToChangeSection('**delete**', toDelete)
    body += PlanCommenter.resourcesToChangeSection('**replace (delete then create)**', toReplace)
    if (
      toCreate.length === 0 &&
      toUpdate.length === 0 &&
      toReplace.length === 0 &&
      toDelete.length === 0
    ) {
      body += 'No changes'
    } else {
      body += `[see details](${await this.linkToWorkflowJob()})`
    }
    return body
  }

  private static resourcesToChangeSection(changeType: string, list: string[]): string {
    let str = ''
    if (list.length > 0) {
      str += `will ${changeType} ${list.length} resource${list.length > 1 ? 's' : ''}:`
      for (const resource of list) {
        str += ` \n  * ${resource}`
      }
      str += '\n\n'
    }
    return str
  }

  // TODO find a way to link directly to job/step. I can't seem to figure out which job is running without hard coding in job names into each of our repos that use this action
  private async linkToWorkflowJob(): Promise<string> {
    const workflow = await this.octokit.rest.actions.getWorkflowRun({
      ...github.context.repo,
      run_id: this.runId
    })
    return workflow.data.html_url
  }
}

run()
