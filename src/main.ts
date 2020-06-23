import * as core from '@actions/core'
import * as github from '@actions/github'

const commentPrefix = 'Terraform Plan:'

async function run(): Promise<void> {
  try {
    core.debug('got inside the action')
    const pr = github.context.payload.pull_request
    if (!pr) return
    core.debug('got issue')

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
    core.debug(`comments: ${JSON.stringify(comments)}`)
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
      core.debug(`Updating existing comment ${previousCommentId}`)
      await octokit.issues.updateComment({
        owner,
        repo,
        issue_number: pr.number,
        comment_id: previousCommentId,
        body: `${commentPrefix}\nUpdated hello there`
      })
    } else {
      core.debug('Creating new comment')
      octokit.issues.createComment({
        owner,
        repo,
        issue_number: pr.number,
        body: `${commentPrefix}\nHello there`
      })
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
