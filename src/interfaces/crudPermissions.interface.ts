import { ICrudPermission } from "./crudPermission.interface";

export interface ICrudPermissions {
  create?: ICrudPermission;
  read?: ICrudPermission;
  update?: ICrudPermission;
  delete?: ICrudPermission;
}
