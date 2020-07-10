export interface TerraformPlan {
  resource_changes?: ResourceChange[]
}

export interface ResourceChange {
  address: string
  type: string
  name: string
  index?: number
  change: ChangeRepresentation
}

export interface ChangeRepresentation {
  actions: Action[]
}

export enum Action {
  'no-op' = 'no-op',
  'create' = 'create',
  'read' = 'read',
  'update' = 'update',
  'delete' = 'delete'
}

export interface PullRequest {
  number: number
  html_url?: string
  body?: string
}
