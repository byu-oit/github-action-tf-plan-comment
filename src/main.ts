import * as core from '@actions/core'
import * as github from '@actions/github'
import fs from 'fs'
import {GitHub} from '@actions/github/lib/utils'
import {Action, PullRequest, TerraformPlan} from './types'

const commentPrefix = '## Terraform Plan:'

async function run(): Promise<void> {
  try {
    core.debug('got inside the action')

    const pr = github.context.payload.pull_request
    if (!pr) {
      core.info('No pull request, exiting action...')
      return
    }
    core.debug('got pull request')

    const jsonFileName = core.getInput('terraform_plan_json_file')
    core.debug(`got fileName: ${jsonFileName}`)
    const json = fs.readFileSync(jsonFileName, 'utf8')
    core.debug(`got json:\n${json}`)
    const terraformPlan: TerraformPlan = JSON.parse(json)
    core.debug('parsed json')
    const token = core.getInput('github_token')
    const runId = parseInt(process.env['GITHUB_RUN_ID'] || '-1')

    const commenter = new PlanCommenter(token, runId, pr)
    await commenter.makePlanComment(terraformPlan)
  } catch (error) {
    core.setFailed(error.message)
  }
}

class PlanCommenter {
  octokit: InstanceType<typeof GitHub>
  runId: number
  pr: PullRequest

  constructor(token: string, runId: number, pr: PullRequest) {
    this.octokit = github.getOctokit(token)
    this.runId = runId
    this.pr = pr
  }

  async makePlanComment(terraformPlan: TerraformPlan): Promise<number> {
    const body = await this.planComment(terraformPlan)
    // find previous comment if it exists
    const comments = await this.octokit.issues.listComments({
      ...github.context.repo,
      issue_number: this.pr.number
    })
    let previousCommentId: number | null = null
    for (const comment of comments.data) {
      if (comment.user.login === 'github-actions[bot]' && comment.body.startsWith(commentPrefix)) {
        previousCommentId = comment.id
      }
    }
    if (previousCommentId) {
      // update the previous comment
      const updatedComment = await this.octokit.issues.updateComment({
        ...github.context.repo,
        issue_number: this.pr.number,
        comment_id: previousCommentId,
        body
      })
      core.info(`Updated existing comment: ${updatedComment.data.html_url}`)
      return updatedComment.data.id
    } else {
      // create new comment if previous comment does not exist
      const createdComment = await this.octokit.issues.createComment({
        ...github.context.repo,
        issue_number: this.pr.number,
        body
      })
      core.info(`Created comment: ${createdComment.data.html_url}`)
      return createdComment.data.id
    }
  }
  async planComment(terraformPlan: TerraformPlan): Promise<string> {
    const toCreate = []
    const toDelete = []
    const toReplace = []
    const toUpdate = []
    for (const resourceChange of terraformPlan.resource_changes) {
      core.debug(`resource: ${JSON.stringify(resourceChange)}`)
      const actions = resourceChange.change.actions
      const resourceName = `${resourceChange.type} - ${resourceChange.name}`
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
      } else {
        core.debug(`Not found? ${actions}`)
      }
    }

    core.debug(`toCreate: ${toCreate}`)
    core.debug(`toUpdate: ${toUpdate}`)
    core.debug(`toReplace: ${toReplace}`)
    core.debug(`toDelete: ${toDelete}`)

    let body = `${commentPrefix}\n`
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
      str += `will ${changeType} ${list.length} resource${list.length > 1 ? 's' : ''}: \n`
      for (const resource of list) {
        str += `- ${resource}`
      }
      str += '\n\n'
    }
    return str
  }

  // TODO find a way to link directly to job/step. I can't seem to figure out which job is running without hard coding in job names into each of our repos that use this action
  private async linkToWorkflowJob(): Promise<string> {
    const workflow = await this.octokit.actions.getWorkflowRun({
      ...github.context.repo,
      run_id: this.runId
    })
    return workflow.data.html_url
  }
}

run()
