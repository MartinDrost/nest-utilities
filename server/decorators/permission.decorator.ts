import { ReflectMetadata } from "@nestjs/common";

import { CrudController } from "../controllers";

export const Permission = (...instance: (() => CrudController<any>)[]) =>
  ReflectMetadata("permission", instance);
