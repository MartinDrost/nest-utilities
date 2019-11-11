import {
  Body,
  CanActivate,
  Delete,
  ExecutionContext,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Document } from "mongoose";
import { ICrudPermission, IHttpOptions, INURequest } from "../interfaces";
import { ICrudPermissions } from "../interfaces/crudPermissions.interface";
import { IMongoConditions } from "../interfaces/mongoConditions.interface";
import { IMongoOptions } from "../interfaces/mongoOptions.interface";
import { IMongoRequest } from "../interfaces/mongoRequest.interface";
import { CrudService } from "../services/crud.abstract.service";

export abstract class CrudController<IModel extends Document> {
  constructor(
    private crudService: CrudService<IModel>,
    private permissions: ICrudPermissions = {}
  ) {}

  @Post()
  create(
    @Req() request: INURequest,
    @Body() model: IModel,
    ...args: any[]
  ): Promise<IModel> {
    this.checkPermissions(this.permissions.create, request.context);

    return this.crudService.create(model, request);
  }

  @Get()
  getAll(
    @Req() request: INURequest,
    @Query() query: IHttpOptions,
    ...args: any[]
  ): Promise<IModel[]> {
    this.checkPermissions(this.permissions.read, request.context);

    const params = this.toMongooseParams(query);
    return this.crudService.find({}, { request, ...params });
  }

  @Get(":id")
  async get(
    @Req() request: INURequest,
    @Param("id") id: string,
    @Query() query: IHttpOptions,
    ...args: any[]
  ): Promise<IModel> {
    this.checkPermissions(this.permissions.read, request.context);

    const params = this.toMongooseParams(query);
    const model = await this.crudService.get(id, { request, ...params });

    if (model === null) {
      throw new NotFoundException("No model with that id found");
    }

    return model;
  }

  @Get("many/:ids")
  getMany(
    @Req() request: INURequest,
    @Param("ids") ids: string,
    @Query() query: IHttpOptions,
    ...args: any[]
  ): Promise<IModel[]> {
    this.checkPermissions(this.permissions.read, request.context);

    const params = this.toMongooseParams(query);
    return this.crudService.getMany(ids.split(","), { request, ...params });
  }

  @Put(":id?")
  put(
    @Req() request: INURequest,
    @Body() model: IModel,
    @Param("id") id?: string,
    ...args: any[]
  ): Promise<IModel> {
    this.checkPermissions(this.permissions.update, request.context);
    if (id) {
      model._id = model.id = id;
    }

    return this.crudService.put(model, request);
  }

  @Patch(":id?")
  patch(
    @Req() request: INURequest,
    @Body() model: IModel,
    @Param("id") id?: string,
    ...args: any[]
  ): Promise<IModel> {
    this.checkPermissions(this.permissions.update, request.context);
    if (id) {
      model._id = model.id = id;
    }

    return this.crudService.patch(model, request);
  }

  @Delete(":id")
  delete(
    @Req() request: INURequest,
    @Param("id") id: string,
    ...args: any[]
  ): Promise<IModel | null> {
    this.checkPermissions(this.permissions.delete, request.context);

    return this.crudService.delete(id, request);
  }

  /**
   * Check permissions based on the provided settings
   * @param permission
   */
  private checkPermissions(
    permission: ICrudPermission | undefined,
    context: ExecutionContext
  ): void {
    if (!permission) {
      return;
    }

    // execute the provided guards
    const clonedContext = Object.assign(
      Object.create(Object.getPrototypeOf(context)),
      context
    );
    clonedContext["metadata"] = permission.data;
    for (const guard of permission.guards) {
      const canActivate = (new guard(
        new Reflector()
      ) as CanActivate).canActivate(clonedContext);

      if (!canActivate) {
        throw new HttpException(
          "The session does not meet the requirements for this endpoint",
          HttpStatus.FORBIDDEN
        );
      }
    }
  }

  /**
   * Converts http query params to Mongoose query Params
   * @param query
   */
  protected toMongooseParams(query: IHttpOptions): IMongoRequest {
    return {
      filters: this.queryToConditions(query),
      options: this.queryToOptions(query),
      populate: this.queryToPopulate(query)
    };
  }

  /**
   * Converts http query params to Mongoose conditions
   * @param query
   */
  private queryToConditions(query: IHttpOptions): IMongoConditions {
    const searchOptions = {};
    // map search conditions to the filter since they behave the same
    if (query.search) {
      const scope = query.searchScope
        ? query.searchScope.split(",")
        : ["_id", ...Object.keys(this.crudService.getSchema())];

      scope.forEach(key => {
        searchOptions[key] = query.search || "";
      });
    }

    // create filter conditions
    const schema = this.crudService.getSchema();
    const conditions: IMongoConditions[][] = [
      searchOptions,
      query.filter || {}
    ].map(conditionPair => {
      const conditions: IMongoConditions[] = [];
      Object.keys(conditionPair).forEach(key => {
        const keyConditions: IMongoConditions[] = [];
        const value = conditionPair[key];
        if (schema[key] && schema[key].type === String) {
          keyConditions.push({ [key]: { $regex: value, $options: "i" } });
        }

        if (!isNaN(+value)) {
          keyConditions.push({ [key]: +value });
        }

        keyConditions.push({ [key]: value });

        conditions.push({ $or: keyConditions });
      });

      return conditions;
    });

    // search statements should be $or and filter $and
    let [$or, $and] = conditions;
    $or = $or.length ? $or : [{}];
    $and = $and.length ? $and : [{}];

    return { $or, $and };
  }
  /**
   * Converts http query params to Mongoose options
   * @param query
   */
  private queryToOptions(query: IHttpOptions): IMongoOptions {
    const options: IMongoOptions = {
      sort: [],
      limit: query.limit ? +query.limit : undefined,
      skip: query.offset ? +query.offset : undefined,
      select: []
    };

    // create sort options
    if (query.sort !== undefined) {
      options.sort = query.sort.split(",");
    }

    if (query.pick !== undefined) {
      options.select = query.pick.split(",");
    }

    return options;
  }

  /**
   * Converts http query params to populatable params
   * @param query
   */
  private queryToPopulate(query: IHttpOptions): string[] | undefined {
    if (query.populate === undefined) {
      return undefined;
    }
    return query.populate ? query.populate.split(",") : [];
  }
}
