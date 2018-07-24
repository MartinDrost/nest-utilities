import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";

import { CrudController } from "../controllers";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * Decide whether the requester has access based on his/her role
   * and the roles defined at the endpoint.
   *
   * @param req
   * @param context
   */
  canActivate(
    context: ExecutionContext
  ): boolean | Promise<boolean> | Observable<boolean> {
    console.log(context.getClass<CrudController<any>>());

    return new PermissionGuard(this.reflector).canActivate(context);
  }
}
