import { CanActivate } from "@nestjs/common";

export interface CrudPermissions {
  create: CanActivate;
  read: CanActivate;
  update: CanActivate;
  delete: CanActivate;
}
