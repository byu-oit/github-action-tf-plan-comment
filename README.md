![CI](https://github.com/byu-oit/github-action-tf-plan-comment/workflows/CI/badge.svg)
![Test](https://github.com/byu-oit/github-action-tf-plan-comment/workflows/Test/badge.svg)

# ![BYU logo](https://www.hscripts.com/freeimages/logos/university-logos/byu/byu-logo-clipart-128.gif) github-action-tf-plan-comment

GitHub Action to make a comment on a pull request with the proposed updated terraform plan

This action takes in the terraform plan and creates a comment on the Pull Request (PR) with basic info about what the plan will create, update, replace, or delete.

**Note:** this action does not run `terraform plan` for you, you must pass in the plan as an input as well as the directory of the terraform configuration (where the plan and .terraform dir are located after `terraform init`).

## Usage
```yaml
on: pull_request
# ...
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    # ... 
    # terraform init
    # terraform plan
    - name: Comment Terraform Plan
      uses: byu-oit/github-action-tf-plan-comment@v1
      with:
        github-token: ${{ secrets.GITHUB_TOKEN }}
        working-directory: terraform-iac/dev/app # where your terraform files are
        terraform-plan-file: plan.tfplan # relative to working directory
```

## Inputs
* `github-token` - (**required**) pass in the GitHub token to make comments on the PR
* `working-directory` - (_optional_) the directory of the terraform configuration files (defaults to `.`)
* `terraform-plan-file` - (**required**) Filename of the terraform plan (relative to `working-directory`)
* `comment-title` - (_optional_) Title for the comment this action will make on your pull request (defaults to `Terraform Plan`)
    
**note**: the `comment-title` is used to determine which PR comment to update.
For instance if you have two of these actions in one PR with the same `comment-title` then they will both try to update the same comment.

## Output
This action will create a comment on your PR like:

> ## Terraform Plan:
> will **replace (delete then create)** 1 resources:
> - aws_security_group_rule - db_access
> 
> will **delete** 1 resources:
> - aws_db_instance - database
> 
>[see details](link to the github action workflow)

## Contributing
Hopefully this is useful to others at BYU.
Feel free to ask me some questions about it, but I make no promises about being able to commit time to support it.

GitHub Actions will run the entry point from the action.yml.
In our case, that happens to be /dist/index.js.

Actions run from GitHub repos.
We don't want to check in node_modules. 
Hence, we package the app using `yarn run pack`.
Make sure you run `yarn run pack` before committing/pushing.

### Modifying Source Code
Just run `yarn install` locally.
There aren't many files here, so hopefully it should be pretty straightforward.

### Cutting new releases
Push your code up to a feature branch.
Create a pull request to the `v1` branch (if it's a non breaking change).

After it's merged into the `v1` branch then, be sure to create a new GitHub release, following SemVer.
Then merge `v1` into `master`.
