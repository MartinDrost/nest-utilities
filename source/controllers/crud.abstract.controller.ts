import {
  Body,
  CanActivate,
  Delete,
  ExecutionContext,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Req,
  Query,
  NotFoundException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Document } from "mongoose";
import { ICrudPermission, INURequest, IHttpOptions } from "../interfaces";
import { ICrudPermissions } from "../interfaces/crudPermissions.interface";
import { CrudService } from "../services/crud.abstract.service";
import { IMongoConditions } from "../interfaces/mongoConditions.interface";
import { IMongoProjection } from "../interfaces/mongoProjection.interface";
import { IMongoOptions } from "../interfaces/mongoOptions.interface";

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

    return this.crudService.create(model);
  }

  @Get()
  getAll(
    @Req() request: INURequest,
    @Query() query: IHttpOptions,
    ...args: any[]
  ): Promise<IModel[]> {
    this.checkPermissions(this.permissions.read, request.context);

    return this.crudService.find({
      request,
      ...this.toMongooseParams(query)
    });
  }

  @Get(":id")
  async get(
    @Req() request: INURequest,
    @Param("id") id: string,
    @Query() query: IHttpOptions,
    ...args: any[]
  ): Promise<IModel> {
    this.checkPermissions(this.permissions.read, request.context);

    const model = await this.crudService.get(id, {
      request,
      ...this.toMongooseParams(query)
    });

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

    return this.crudService.getMany(ids.split(","), {
      request,
      ...this.toMongooseParams(query)
    });
  }

  @Put()
  put(
    @Req() request: INURequest,
    @Body() model: IModel,
    ...args: any[]
  ): Promise<IModel> {
    this.checkPermissions(this.permissions.update, request.context);

    return this.crudService.put(model as IModel, request);
  }

  @Patch()
  patch(
    @Req() request: INURequest,
    @Body() model: IModel,
    ...args: any[]
  ): Promise<IModel> {
    this.checkPermissions(this.permissions.update, request.context);

    return this.crudService.patch(model as IModel, request);
  }

  @Delete(":id")
  delete(
    @Req() request: INURequest,
    @Param("id") id: string,
    ...args: any[]
  ): Promise<IModel | null> {
    this.checkPermissions(this.permissions.delete, request.context);

    return this.crudService.delete(id);
  }

  /**
   * Check permissions based on the provided settings
   * @param permission
   */
  protected checkPermissions(
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
  protected toMongooseParams(query: IHttpOptions) {
    return {
      conditions: this.queryToConditions(query),
      projection: this.queryToProjection(query),
      options: this.queryToOptions(query)
    };
  }

  /**
   * Converts http query params to Mongoose conditions
   * @param query
   */
  private queryToConditions(query: IHttpOptions): IMongoConditions {
    const conditions = {};

    // create search condition
    if (query.search) {
      // get either the search scope or every key of the schema
      const scope = query.searchScope
        ? query.searchScope.split(",")
        : Object.keys(this.crudService.crudModel.schema.obj);

      scope.forEach(key => {
        conditions[key] = { $regex: query.search, $options: "i" };
      });
    }

    // create filter conditions
    Object.keys(query.filter || {}).forEach(key => {
      conditions[key] = { $regex: query.filter![key], $options: "i" };
    });

    return conditions;
  }

  /**
   * Converts http query params to Mongoose projections
   * @param query
   */
  private queryToProjection(query: IHttpOptions): IMongoProjection {
    const projection = {};
    const picks = (query.pick || "").split(",");

    // equal the projection to each picked attribute
    picks.forEach(pick => {
      projection[pick] = 1;
    });

    return projection;
  }

  /**
   * Converts http query params to Mongoose options
   * @param query
   */
  private queryToOptions(query: IHttpOptions): IMongoOptions {
    const options: IMongoOptions = {
      populate: [],
      sort: [],
      limit: query.limit ? +query.limit : undefined,
      skip: query.offset ? +query.offset : undefined
    };

    // create populate options
    if (query.populate !== undefined) {
      const virtuals = (this.crudService.crudModel.schema as any).virtuals;

      // get either the provided keys or every ref from the schema
      options.populate = query.populate
        ? query.populate.split(",")
        : Object.keys(virtuals).filter(key => virtuals[key].options.ref);
    }

    // create sort options
    if (query.sort !== undefined) {
      options.sort = query.sort.split(",");
    }

    return options;
  }
}
