export interface TerraformPlan {
  resource_changes: ResourceChange[]
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
  'no-op',
  'create',
  'read',
  'update',
  'delete'
}
