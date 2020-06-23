import * as core from '@actions/core'
import * as github from '@actions/github'

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
    for (const comment of comments.data) {
      core.debug(`comment: ${JSON.stringify(comment)}`)
    }
    const previousCommentId = core.getState('commentId')
    core.debug(`previousCommentId: ${previousCommentId}`)
    if (previousCommentId) {
      core.debug('We have a previous commentId')
    }
    const commentResponse = await octokit.issues.createComment({
      owner,
      repo,
      issue_number: pr.number,
      body: 'Hello there 2'
    })
    core.debug(commentResponse.data.url)
    core.saveState('commentId', commentResponse.data.id)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
