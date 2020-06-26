<p align="center">
  <a href="https://github.com/actions/typescript-action/actions"><img alt="typescript-action status" src="https://github.com/actions/typescript-action/workflows/build-test/badge.svg"></a>
</p>

# ![BYU logo](https://www.hscripts.com/freeimages/logos/university-logos/byu/byu-logo-clipart-128.gif) github-action-tf-plan-comment

GitHub Action to make a comment on a pull request with the proposed updated terraform plan

This action takes in a JSON representation of your terraform plan and creates a comment on the Pull Request (PR) with basic info about what the plan will create, update, replace, or delete.

**Note:** this action does not run terraform plan for you, you must pass in the plan as an input.

## Usage
```yaml
on: pull_request
# ...
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    # ... 
    - name: Terraform Setup
      uses: hashicorp/setup-terraform@v1
      with:
        terraform_version: ${{ env.tf_version }}
        terraform_wrapper: false
    # terraform init
    # terraform plan
    - name: Comment Terraform Plan
      uses: byu-oit/github-action-tf-plan-comment@v1
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        terraform_plan_file: plan.tfplan
```

**Note:** make sure you run your `terraform show-json plan` in the same working directory as the `terraform plan` step, and make sure you.
Also the setup-terraform action by default puts a wrapper around the stdout of commands, so trying to use `terraform show -json > plan.json` will save more than just the json output to the json file.
We disable the wrapper in this example so that you can pipe the output to a file.  

This action will create a comment on your PR like:

> ## Terraform Plan:
> will **replace (delete then create)** 1 resources:
> - aws_security_group_rule - db_access
> 
> will **delete** 1 resources:
> - aws_db_instance - database
> 
>[see details](link to the github action workflow)


## Inputs
* `github_token` - (**required**) pass in the GitHub token to make comments on the PR
* `terraform_plan_file` - (**required**) Filename of the terraform plan

## Contributing
Hopefully this is useful to others at BYU.
Feel free to ask me some questions about it, but I make no promises about being able to commit time to support it.

GitHub Actions will run the entry point from the action.yml.
In our case, that happens to be /dist/index.js.

Actions run from GitHub repos.
We don't want to check in node_modules. Hence, we package the app using `yarn run pack`.

### Modifying Source Code
Just run `yarn install` locally.
There aren't many files here, so hopefully it should be pretty straightforward.

### Cutting new releases
Push your code up to a feature branch.
Create a pull request to the `v1` branch (if it's a non breaking change).

After it's merged into the `v1` branch then, be sure to create a new GitHub release, following SemVer.
Then merge `v1` into `master`.
