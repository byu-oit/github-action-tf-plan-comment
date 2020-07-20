import {PlanCommenter} from '../src/main'
import {Action, PullRequest, TerraformPlan} from '../src/types'
import * as github from '@actions/github'
import nock = require('nock')

const pr: PullRequest = {
  number: -1,
  body: '',
  html_url: ''
}
const basicTestPlan: TerraformPlan = {
  resource_changes: [
    {
      address: 'local_file.fake_file',
      type: 'local_file',
      name: 'fake_file',
      change: {
        actions: [Action.delete, Action.create]
      }
    }
  ]
}
process.env['GITHUB_REPOSITORY'] = 'https://github.com/byu-oit/github-action-tf-plan-comment'

test('Test Basic Plan Summary', async () => {
  const scope = nock('https://api.github.com')
    .get(/.*/)
    .reply(200, {
      html_url: 'https://test/workflow/url'
    })

  const commenter = new PlanCommenter({
    octokit: github.getOctokit('fake'),
    runId: 1234,
    pr
  })

  const summary = await commenter.planSummaryBody(basicTestPlan)
  const expected = `## Terraform Plan:
will **replace (delete then create)** 1 resource: 
  * local_file - fake_file

[see details](https://test/workflow/url)`
  expect(summary).toEqual(expected)

  scope.done()
})

test('Test Empty Plan Summary', async () => {
  const commenter = new PlanCommenter({
    octokit: github.getOctokit('fake'),
    runId: 1234,
    pr
  })
  const emptyPlan: TerraformPlan = {}
  const summary = await commenter.planSummaryBody(emptyPlan)
  const expected = `## Terraform Plan:
No changes detected`
  expect(summary).toEqual(expected)
})

test('Test Basic Plan with custom title', async () => {
  const scope = nock('https://api.github.com')
    .get(/.*/)
    .reply(200, {
      html_url: 'https://test/workflow/url'
    })

  const commenter = new PlanCommenter({
    octokit: github.getOctokit('fake'),
    runId: 1234,
    pr,
    commentTitle: 'Test Plan Title'
  })

  const summary = await commenter.planSummaryBody(basicTestPlan)
  const expected = `## Test Plan Title:
will **replace (delete then create)** 1 resource: 
  * local_file - fake_file

[see details](https://test/workflow/url)`
  expect(summary).toEqual(expected)

  scope.done()
})
