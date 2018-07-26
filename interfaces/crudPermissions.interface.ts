import { CrudPermission } from "./crudPermission.interface";

export interface CrudPermissions {
  create?: CrudPermission;
  read?: CrudPermission;
  update?: CrudPermission;
  delete?: CrudPermission;
}
