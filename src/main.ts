import * as core from '@actions/core'
import * as github from '@actions/github'
import {Action, TerraformPlan} from './types'

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

    const terraformPlan: TerraformPlan = JSON.parse(
      core.getInput('terraform_plan_json')
    )

    const token = core.getInput('github_token')
    const nwo = process.env['GITHUB_REPOSITORY'] || '/'
    const [owner, repo] = nwo.split('/')
    const octokit = github.getOctokit(token)

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
    if (toCreate.length > 0) {
      body += `will create ${toCreate.length} resources: \n`
      for (const resource of toCreate) {
        body += `- ${resource}`
      }
      body += '\n\n'
    }
    if (toUpdate.length > 0) {
      body += `will update ${toUpdate.length} resources: \n`
      for (const resource of toUpdate) {
        body += `- ${resource}`
      }
      body += '\n\n'
    }
    if (toReplace.length > 0) {
      body += `will replace (**delete** then create) ${toReplace.length} resources: \n`
      for (const resource of toReplace) {
        body += `- ${resource}`
      }
      body += '\n\n'
    }
    if (toDelete.length > 0) {
      body += `will **delete** ${toDelete.length} resources: \n`
      for (const resource of toDelete) {
        body += `- ${resource}`
      }
      body += '\n\n'
    }
    if (
      toCreate.length === 0 &&
      toUpdate.length === 0 &&
      toReplace.length === 0 &&
      toDelete.length === 0
    ) {
      body += 'No changes'
    } else {
      // TODO find a way to link directly to job/step
      body += `[see details](https://github.com/${owner}/${repo}/actions/runs/${process.env['GITHUB_RUN_ID']})`
    }

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
      await octokit.issues.createComment({
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
