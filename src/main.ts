import * as core from '@actions/core'
import * as github from '@actions/github'

async function run(): Promise<void> {
  try {
    const issue = github.context.payload.issue
    if (!issue) return

    const token = process.env['GITHUB_TOKEN']
    if (!token) return

    const octokit = github.getOctokit(token)
    const nwo = process.env['GITHUB_REPOSITORY'] || '/'
    const [owner, repo] = nwo.split('/')

    core.debug('hi')
    const commentResponse = await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issue.number,
      body: 'Hello there'
    })
    core.debug(commentResponse.data.url)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
