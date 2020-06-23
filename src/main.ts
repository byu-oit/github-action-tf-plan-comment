import * as core from '@actions/core'
import * as github from '@actions/github'
import {Action, TerraformPlan} from './types'

const commentPrefix = 'Terraform Plan:'

function actionsEqual(a: Action[], b: Action[]): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (a.length !== b.length) return false

  // If you don't care about the order of the elements inside
  // the array, you should sort both arrays here.
  // Please note that calling sort on an array will modify that array.
  // you might want to clone your array first.

  a.sort(a1 => a1.valueOf())
  b.sort(b1 => b1.valueOf())
  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false
  }
  return true
}

async function run(): Promise<void> {
  try {
    core.debug('got inside the action')

    const pr = github.context.payload.pull_request
    if (!pr) {
      core.info('No pull request, exiting action...')
      return
    }
    core.debug('got pull request')

    const terraformPlan: TerraformPlan = JSON.parse(
      core.getInput('terraform_plan_json')
    )
    const toCreate = []
    const toDelete = []
    const toReplace = []
    const toUpdate = []
    for (const resourceChange of terraformPlan.resource_changes) {
      core.debug(`resource: ${JSON.stringify(resourceChange)}`)
      const actions = resourceChange.change.actions
      if (actionsEqual(actions, [Action.create])) {
        core.debug('adding to toCreate')
        toCreate.push(`${resourceChange.type} ${resourceChange.name}`)
      } else if (actionsEqual(actions, [Action.delete])) {
        core.debug('adding to toDelete')
        toDelete.push(`${resourceChange.type} ${resourceChange.name}`)
      } else if (actionsEqual(actions, [Action.delete])) {
        core.debug('adding to toReplace')
        toReplace.push(`${resourceChange.type} ${resourceChange.name}`)
      } else if (actionsEqual(actions, [Action.delete])) {
        core.debug('adding to toUpdate')
        toUpdate.push(`${resourceChange.type} ${resourceChange.name}`)
      } else {
        core.debug(`Not found? ${actions}`)
      }
    }

    core.debug(`toCreate: ${toCreate}`)
    core.debug(`toUpdate: ${toUpdate}`)
    core.debug(`toReplace: ${toReplace}`)
    core.debug(`toDelete: ${toDelete}`)

    let body = `${commentPrefix}\n`
    body += `Terraform will create: ${toCreate}\n`
    body += `Terraform will update: ${toUpdate}\n`
    body += `Terraform will replace (delete then create): ${toReplace}\n`
    body += `Terraform will delete: ${toDelete}\n`
    // TODO add link to workflow in the comment

    const token = core.getInput('github_token')
    core.debug('got token')

    const octokit = github.getOctokit(token)
    const nwo = process.env['GITHUB_REPOSITORY'] || '/'
    const [owner, repo] = nwo.split('/')

    core.debug(`owner: ${owner}, repo: ${repo}`)
    // find previous comment if it exists
    const comments = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: pr.number
    })
    let previousCommentId: number | null = null
    for (const comment of comments.data) {
      if (
        comment.user.login === 'github-actions[bot]' &&
        comment.body.startsWith(commentPrefix)
      ) {
        previousCommentId = comment.id
      }
    }
    if (previousCommentId) {
      // update the previous comment
      core.debug(`Updating existing comment ${previousCommentId}`)
      await octokit.issues.updateComment({
        owner,
        repo,
        issue_number: pr.number,
        comment_id: previousCommentId,
        body
      })
    } else {
      // create new comment if previous comment does not exist
      core.debug('Creating new comment')
      octokit.issues.createComment({
        owner,
        repo,
        issue_number: pr.number,
        body
      })
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
