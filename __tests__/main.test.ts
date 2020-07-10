import {PlanCommenter} from '../src/main'
import {Action, PullRequest, TerraformPlan} from '../src/types'
import * as github from '@actions/github'
import nock = require('nock')

const pr: PullRequest = {
  number: -1,
  body: '',
  html_url: ''
}
process.env['GITHUB_REPOSITORY'] = 'https://github.com/byu-oit/github-action-tf-plan-comment'

test('Test Basic Plan Summary', async () => {
  const scope = nock('https://api.github.com')
    .get(/.*/)
    .reply(200, {
      html_url: 'https://test/workflow/url'
    })

  const commenter = new PlanCommenter(github.getOctokit('fake'), 1234, pr)
  const plan: TerraformPlan = {
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
  const summary = await commenter.planSummaryBody(plan)
  const expected = `## Terraform Plan:
will **replace (delete then create)** 1 resource: 
  * local_file - fake_file

[see details](https://test/workflow/url)`
  expect(summary).toEqual(expected)

  scope.done()
})

test('Test Empty Plan Summary', async () => {
  const commenter = new PlanCommenter(github.getOctokit('fake'), 1234, pr)
  const emptyPlan: TerraformPlan = {}
  const summary = await commenter.planSummaryBody(emptyPlan)
  const expected = `## Terraform Plan:
No changes detected`
  expect(summary).toEqual(expected)
})
