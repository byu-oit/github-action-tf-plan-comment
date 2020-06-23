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
    core.debug(`from env ${process.env['GITHUB_TOKEN']}`)

    const octokit = github.getOctokit(token)
    const nwo = process.env['GITHUB_REPOSITORY'] || '/'
    const [owner, repo] = nwo.split('/')

    core.debug('hi')
    const commentResponse = await octokit.issues.createComment({
      owner,
      repo,
      issue_number: pr.number,
      body: 'Hello there'
    })
    core.debug(commentResponse.data.url)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
