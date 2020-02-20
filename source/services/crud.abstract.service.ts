import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Response } from "express";
import _isNil from "lodash/isNil";
import _merge from "lodash/merge";
import _mergeWith from "lodash/mergeWith";
import { Document, Model, ModelPopulateOptions } from "mongoose";
import { IMongoConditions, INuRequest } from "../interfaces";
import { INuOptions } from "../interfaces/nuOptions.interface";
import { getDeepKeys, isObjectID, mergePopulateOptions } from "../utilities";

export abstract class CrudService<IModel extends Document> {
  /**
   * A static object keeping track of which service belongs to which schema
   */
  private static serviceMap: { [modelName: string]: CrudService<any> } = {};

  /**
   * An array containing all fields which should not be taken into account
   * when performing user generated queries.
   */
  protected fieldBlacklist: string[] = [];

  constructor(protected crudModel: Model<IModel>) {
    CrudService.serviceMap[crudModel.modelName] = this;
  }

  /**
   * Save a new modelItem
   * @param modelItem
   */
  public async create(
    modelItem: Omit<IModel, keyof Document>,
    request?: INuRequest | any,
    ...args: any[]
  ): Promise<IModel> {
    // make sure no leftover id exists
    delete modelItem["_id"];

    let model = await this.onCreateRequest(modelItem, request);

    const created = await new this.crudModel(model).save();
    return this.onAfterCreateRequest(created, request);
  }

  /**
   * Create a modelItem if it doesn't exist, merge it otherwise
   * @param modelItem
   */
  public async createOrPatch(
    modelItem: IModel,
    request?: INuRequest | any,
    ...args: any[]
  ): Promise<IModel> {
    if (modelItem._id || modelItem.id) {
      const existing = await this.get(modelItem._id || modelItem.id);
      if (existing !== null) {
        return this.patch(modelItem);
      }
    }

    return this.create(modelItem);
  }

  /**
   * Get a modelItem by its id
   * @param id
   */
  public async get(
    id: string,
    options: INuOptions = {},
    ...args: any[]
  ): Promise<IModel | null> {
    if (isObjectID(id) === false) {
      return null;
    }

    return this.findOne({ _id: id }, options);
  }

  /**
   * Find a single model
   * @param options
   */
  public async findOne(
    conditions: IMongoConditions<IModel> = {},
    options: INuOptions = {}
  ): Promise<IModel | null> {
    options.limit = 1;

    const response = await this.find(conditions, options);
    if (response.length) {
      return response[0];
    }

    return null;
  }

  /**
   * Counts the number of documents which should be returned with the given conditions.
   * If defined, the onFindRequest conditions will also be appended
   * @param conditions
   * @param options
   */
  public async countDocuments(
    conditions: IMongoConditions<IModel> = {},
    options: INuOptions = {}
  ): Promise<number> {
    // merge filter and conditions
    conditions = this.cast(
      _merge(conditions, options.filter || {}, {
        $and: [{}, await this.onFindRequest(options.request)]
      })
    );

    const response = await this.getMongoResponse(
      conditions,
      {
        distinct: options.distinct
      },
      [
        {
          $count: "count"
        },
        { $limit: 1 }
      ]
    );

    return response[0]?.count || 0;
  }

  /**
   * Find models
   * @param options
   */
  public async find(
    conditions: IMongoConditions<IModel> = {},
    options: INuOptions = {}
  ): Promise<IModel[]> {
    // merge filter and conditions
    conditions = this.cast(
      _merge(conditions, options.filter || {}, {
        $and: [{}, await this.onFindRequest(options.request)]
      })
    );

    if (options.request?.context) {
      // store the amount of documents without limit in a response header
      const response = options.request.context
        .switchToHttp()
        .getResponse<Response>();

      const numberOfDocuments = await this.countDocuments(conditions, options);

      response.header("X-total-count", numberOfDocuments.toString());
      response.header("Access-Control-Expose-Headers", [
        "X-total-count",
        (response.getHeader("Access-Control-Expose-Headers") || "").toString()
      ]);
    }

    const models = await this.getResponse(conditions, options);

    return Promise.all(models);
  }

  /**
   * Get multiple modelItems by their id
   * @param id
   */
  public getMany(
    ids: string[],
    options: INuOptions = {},
    ...args: any[]
  ): Promise<IModel[]> {
    return this.find({ _id: { $in: ids } }, options);
  }

  /**
   * Merge with an existing modelItem
   * @param modelItem
   */
  public async patch(
    modelItem: Partial<IModel>,
    request?: INuRequest | any,
    ...args: any[]
  ): Promise<IModel> {
    const existing = await this.get(modelItem._id || modelItem.id || "");
    if (existing === null) {
      throw new NotFoundException(
        `No ${this.crudModel.name} found with the provided id`
      );
    }

    let model = { ...(modelItem.toObject ? modelItem.toObject() : modelItem) };
    model = await this.onUpdateRequest(model, request);

    // remove version number
    delete model.__v;

    const updated = await _mergeWith(existing, model, (obj, src) =>
      !_isNil(src) ? src : obj
    ).save();

    return this.onAfterUpdateRequest(updated, request);
  }

  /**
   * Overwrite the model item with the corresponding id
   * @param modelItem
   * @param args
   */
  public async put(
    modelItem: IModel,
    request?: INuRequest | any,
    ...args: any
  ): Promise<IModel> {
    modelItem._id = modelItem._id || modelItem.id;

    let model = await this.get(modelItem._id || modelItem.id || "");
    if (model === null) {
      throw new NotFoundException(
        `No ${this.crudModel.name} found with the provided id`
      );
    }

    // remove version number
    delete modelItem.__v;

    modelItem = (await this.onUpdateRequest(modelItem, request)) as IModel;
    await this.crudModel.replaceOne({ _id: model._id }, modelItem).exec();

    const updated = await this.crudModel.findById(modelItem._id).exec();
    return this.onAfterUpdateRequest(updated!, request);
  }

  /**
   * Delete a modelItem by its id
   * @param id
   */
  public async delete(
    id: string,
    request?: INuRequest | any,
    ...args: any[]
  ): Promise<IModel | null> {
    if (isObjectID(id) === false) {
      return null;
    }
    const model = await this.get(id);
    if (!model) {
      return null;
    }

    await this.onDeleteRequest(model, request);

    const deleted = await this.crudModel.findByIdAndRemove(id).exec();
    await this.onAfterDeleteRequest(deleted!, request);

    return deleted;
  }

  /**
   * Find models and delete them
   * @param conditions
   */
  public async findAndDelete(
    conditions: Partial<IModel>,
    request?: INuRequest | any,
    ...args: any[]
  ): Promise<(IModel | null)[]> {
    const found = await this.find(conditions);

    return await Promise.all(
      found.map(model => this.delete(model._id, request)!)
    );
  }

  /**
   * Throws an exception based on the availability of the model
   * @param id
   * @param request
   */
  async checkEligibility(id: string, request?: INuRequest) {
    const company = await this.findOne({ _id: id });
    if (!company) {
      throw new NotFoundException(
        `No ${this.crudModel.name} found with the provided id`
      );
    }

    const eligibleCompany = await this.findOne({ _id: id }, { request });
    if (!eligibleCompany) {
      throw new ForbiddenException(
        `You are not allowed to access that ${this.crudModel.name}`
      );
    }
  }

  /**
   * Returns an array with all referencing virtuals of the services' model
   */
  public getReferenceVirtuals(): string[] {
    const virtuals = (this.crudModel.schema as any).virtuals;

    return Object.keys(virtuals).filter(key => !!virtuals[key].options.ref);
  }

  /**
   * Returns the schema object of the services' model
   */
  public getSchema(): any {
    const schema = {};
    for (const key of Object.keys(this.crudModel.schema.obj)) {
      if (!this.fieldBlacklist.includes(key)) {
        schema[key] = this.crudModel.schema.obj[key];
      }
    }
    return schema;
  }

  /**
   * Populate a retrieved model
   * @param model
   */
  public async populate(
    model: IModel,
    paths: string[] = [],
    picks: string[] = [],
    request?: INuRequest | any
  ): Promise<IModel> {
    if (!model.populate) {
      if (!model._id && !model.id) {
        return model;
      } else {
        return (await this.get(model._id || model._id, {
          populate: paths
        }))!;
      }
    }

    // use given paths or the defaul referencing virtuals to populate
    paths = paths.length ? paths : this.getReferenceVirtuals();
    return model
      .populate(await this.getPopulateParams(paths, picks, request))
      .execPopulate();
  }

  /**
   * Populate a list of retrieved models
   * @param models
   */
  public populateList(
    models: IModel[],
    paths: string[] = [],
    picks: string[] = [],
    request?: INuRequest | any
  ): Promise<IModel[]> {
    return Promise.all(
      models.map(model => this.populate(model, paths, picks, request))
    );
  }

  /**
   * This method is called when a create request has been initiated.
   * The model returned from the method will be used in the create call which allows you to alter the
   * object based on the rights of the requester or throw an (http)error if the request may not be completed.
   *
   * The request originates from Express and ideally contains a user object
   * to decide the right conditions.
   *
   * Override this method to use it.
   *
   * @param request the Express request originating from the controller
   * @param model the model which is to be created
   */
  public async onCreateRequest(
    model: Omit<IModel, keyof Document>,
    request?: INuRequest | any
  ): Promise<Omit<IModel, keyof Document>> {
    return model;
  }

  /**
   * This method is called when a create request has been completed.
   * The model returned from the method will be returned as the result of the create request.
   *
   * The request originates from Express and ideally contains a user object
   * to decide the right conditions.
   *
   * Override this method to use it.
   *
   * @param request the Express request originating from the controller
   * @param model the model which is to be created
   */
  public async onAfterCreateRequest(
    model: IModel,
    request?: INuRequest | any
  ): Promise<IModel> {
    return model;
  }

  /**
   * This method is called when a find or count request has been initiated.
   * The response should consist of an array of conditions which will be appended to the `$and` field of
   * the Mongoose query.
   *
   * The request originates from Express and ideally contains a user object
   * to decide the right conditions.
   *
   * Override this method to use it.
   *
   * @param request the Express request originating from the controller
   */
  public async onFindRequest(
    request?: INuRequest | any
  ): Promise<IMongoConditions<IModel>> {
    return {};
  }

  /**
   * This method is called when an update request has been initiated.
   * The model returned from the method will be used in the update call which allows you to alter the
   * object based on the rights of the requester or throw an (http)error if the request may not be completed.
   *
   * The request originates from Express and ideally contains a user object
   * to decide the right conditions.
   *
   * Override this method to use it.
   *
   * @param request the Express request originating from the controller
   * @param model the new version of the model which is to be updated
   */
  public async onUpdateRequest(
    model: Partial<IModel>,
    request?: INuRequest | any
  ): Promise<Partial<IModel>> {
    return model;
  }
  /**
   * This method is called when an update request has been completed.
   * The model returned will be used as the result of the update request.
   *
   * The request originates from Express and ideally contains a user object
   * to decide the right conditions.
   *
   * Override this method to use it.
   *
   * @param request the Express request originating from the controller
   * @param model the new version of the model which is to be updated
   */
  public async onAfterUpdateRequest(
    model: IModel,
    request?: INuRequest | any
  ): Promise<IModel> {
    return model;
  }

  /**
   * This method is called when a delete request has been initiated.
   * The requested model has been provided as param. This allows you to check if the user has the correct
   * rights and throw an error if the request may not be completed.
   *
   * The request originates from Express and ideally contains a user object
   * to decide the right conditions.
   *
   * Override this method to use it.
   *
   * @param request the Express request originating from the controller
   * @param id the id of the model the request is trying to delete
   */
  public async onDeleteRequest(
    model: IModel,
    request?: INuRequest | any
  ): Promise<void> {}

  /**
   * This method is called when a delete request has been completed.
   * The requested model has been provided as param. This allows you to perform post-deletion actions
   *
   * The request originates from Express and ideally contains a user object
   * to decide the right conditions.
   *
   * Override this method to use it.
   *
   * @param request the Express request originating from the controller
   * @param id the id of the model the request is trying to delete
   */
  public async onAfterDeleteRequest(
    model: IModel,
    request?: INuRequest | any
  ): Promise<void> {}

  /**
   * Build and return recursive populate() params for Mongoose
   * @param paths
   * @param picks
   */
  private async getPopulateParams(
    paths: string[],
    picks: string[] = [],
    request?: INuRequest | any
  ): Promise<ModelPopulateOptions[]> {
    return mergePopulateOptions(
      (
        await Promise.all(
          paths.map(path => this.deepPopulate(path, picks, request))
        )
      ).filter(param => param !== undefined) as ModelPopulateOptions[]
    );
  }

  /**
   * Creates deep population options including select options
   *
   * @param path the current field including children
   * @param picks all picks defined in the select options
   * @param request the accompanying request
   * @param journey the passed fields so far
   */
  private async deepPopulate(
    path: string,
    picks: string[],
    request?: INuRequest | any,
    journey: string[] = []
  ): Promise<ModelPopulateOptions | undefined> {
    if (!path) {
      return undefined;
    }

    // get the current position and remove it from the journey
    const pathParts = path.split(".");
    const currentPosition = pathParts.shift()!;

    // gather current pick selectors
    const selection = picks
      .map(pick => {
        // popping results in the pickParts containing the current layer
        const pickParts = pick.split(".");
        const field = pickParts.pop();

        if (pickParts.join(".") === [...journey, currentPosition].join(".")) {
          return field;
        }
        return undefined;
      })
      .filter(item => !!item);

    return {
      path: currentPosition,
      select: selection.join(" ") || undefined,
      match: await this.getPopulateConditions(
        [...journey, currentPosition].join("."),
        request
      ),

      populate:
        (await this.deepPopulate(pathParts.join("."), picks, request, [
          ...journey,
          currentPosition
        ])) || []
    };
  }

  /**
   * Retrieve the correct match condition based on the attribute path
   * @param path
   * @param request
   */
  private async getPopulateConditions(
    path: string,
    request?: INuRequest | any
  ): Promise<IMongoConditions<IModel>> {
    // no request means no user to authorize
    if (!request) {
      return {};
    }

    // iterate through the path to find the correct service to populate
    let service: CrudService<IModel> = this;
    let haystack = {
      ...service.getSchema(),
      ...(service.crudModel.schema as any).virtuals
    };

    path.split(".").forEach(position => {
      if (haystack[position]) {
        haystack = haystack[position];

        // switch services if we encounter a reference
        const ref = haystack.options ? haystack.options.ref : haystack.ref;
        if (ref) {
          service = CrudService.serviceMap[ref];
          haystack = {
            ...service.getSchema(),
            ...(service.crudModel.schema as any).virtuals
          };
        }
      }
    });

    return service.onFindRequest(request);
  }

  /**
   * Casts the values of the mongo conditions to their corresponding types
   * @param conditions
   */
  private cast(conditions: IMongoConditions): IMongoConditions {
    Object.keys(conditions).forEach(key => {
      const value = conditions[key];
      if (key.startsWith("$")) {
        if (["$and", "$or", "$nor"].includes(key)) {
          conditions[key] = Array.isArray(value)
            ? value.map(item => this.cast(item))
            : this.cast(value);
        }
        return;
      }

      // cast the value if a type is found
      const type = this.getFieldType(key);
      if (type) {
        // take sub-objects into account like $in
        if (typeof value === "object" && !Array.isArray(value)) {
          Object.keys(value).forEach(subKey => {
            const subValue = value[subKey];
            if (!subKey.startsWith("$") || typeof subValue === "boolean") {
              return;
            }

            conditions[key][subKey] = Array.isArray(subValue)
              ? subValue.map(v => this.castValue(v, type))
              : this.castValue(subValue, type);
          });
        } else {
          conditions[key] = Array.isArray(value)
            ? value.map(v => this.castValue(v, type))
            : this.castValue(value, type);
        }
      }
    });

    return conditions;
  }

  /**
   * Returns the type of the given field
   * @param path
   */
  public getFieldType(path: string): string | null {
    const field = path.split(".").pop();
    if (field === "_id") {
      return "ObjectId";
    }

    let object = this.getSchema();
    let service: CrudService<any> = this;
    path.split(".").forEach(key => {
      // first check if the field is a reference
      const virtual = (service.crudModel.schema as any).virtuals[key];
      if (virtual?.options?.ref) {
        // move to the next service
        service = CrudService.serviceMap[virtual.options.ref];
        const schema = service?.getSchema();
        if (schema) {
          object = schema;
        }
        return;
      }

      // check for the field inside the schema otherwise
      if (!object) {
        return;
      }

      object = object[key];
      if (Array.isArray(object)) {
        object = object[0];
      }
      object = object?.type || object;
      object = object?.obj || object;
    });

    return object?.name || object?.schemaName || null;
  }

  /**
   * Cast the value to the given type
   *
   * supported types: String, Number, Date, Boolean, ObjectId
   *
   * @param value
   * @param type
   */
  private castValue(value: any, type: string): any {
    if (value === null || value === undefined) {
      return null;
    }

    if (Array.isArray(value) || typeof value === "object") {
      return value;
    }

    try {
      switch (type) {
        case "String":
          return value + "";
        case "Number":
          return +value;
        case "Date":
          return new Date(value);
        case "ObjectId":
          return require("bson-objectid")(value);
        case "Boolean":
          if ([true, false, 1, 0, "true", "false", "1", "0"].includes(value))
            return [true, 1, "true", "1"].includes(value);
          else return value;
        default:
          return value;
      }
    } catch {
      return value;
    }
  }

  /**
   * Builds and returns a lookup pipeline to aggregate virtuals
   * @param keys
   */
  private getLookupPipeline(keys: string[]): IMongoConditions[] {
    const pipeline: IMongoConditions[] = [];
    for (const key of keys) {
      const path = key.split(".").filter(field => !field.includes("$")); // filter $in, $or etc.
      path.pop(); // remove the last step since it points to the field

      let service: CrudService<any> = this;
      const journey: string[] = [];
      for (const field of path) {
        const virtual = (service.crudModel.schema as any).virtuals[field];
        if (!virtual?.options?.justOne) {
          break;
        }

        // move to the next service
        service = CrudService.serviceMap[virtual.options.ref];

        // map journey
        journey.push(field);

        // add the lookup
        pipeline.push({
          $lookup: {
            from: service.crudModel.collection.collectionName,
            localField: virtual.options.localField,
            foreignField: virtual.options.foreignField,
            as: journey.join(".")
          }
        });

        // add the unwind
        pipeline.push({
          $unwind: {
            path: `$${journey.join(".")}`,
            preserveNullAndEmptyArrays: true
          }
        });
      }
    }

    return pipeline;
  }

  /**
   * Returns dehydrated mongo response based on the generated and given pipeline
   * @param conditions
   * @param options
   * @param extraPipelines
   */
  private async getMongoResponse(
    conditions: IMongoConditions,
    options: INuOptions,
    extraPipelines: IMongoConditions[] = []
  ) {
    // get field selection
    const projection = {};
    options.select
      ?.filter(field => !field.includes("."))
      .forEach(field => (projection[field] = 1));

    // get field sorting
    const sort = {};
    options.sort?.forEach(field => {
      const desc = field.startsWith("-");
      const cleanField = desc ? field.replace("-", "") : field;
      sort[cleanField] = desc ? -1 : 1;
    });

    // execute an aggregate query
    const keys = Array.from(
      new Set(
        getDeepKeys(conditions)
          .map(key =>
            key
              .split(".")
              .filter(field => !field.includes("$"))
              .join(".")
          )
          .concat(Object.keys(sort))
          .filter(key => key.includes("."))
      )
    );

    // aggregate targeted virtuals
    const pipeline = this.getLookupPipeline(keys);
    pipeline.push({ $match: conditions });

    // add distinct grouping
    if (options.distinct) {
      pipeline.push({
        $group: {
          _id: `$${options.distinct}`,
          doc: { $first: "$$ROOT" }
        }
      });
      pipeline.push({ $replaceRoot: { newRoot: "$doc" } });
    }

    // add options
    if (!options.random && Object.keys(sort).length) {
      pipeline.push({ $sort: sort });
    }

    if (options.random) {
      const size = options.limit ?? (await this.countDocuments(conditions));

      pipeline.push({ $sample: { size } });
    }

    if (options.skip) {
      pipeline.push({ $skip: options.skip });
    }
    if (options.limit) {
      pipeline.push({ $limit: options.limit });
    }
    if (Object.keys(projection).length) {
      pipeline.push({ $project: projection });
    }

    return this.crudModel.collection
      .aggregate(pipeline.concat(extraPipelines))
      .toArray();
  }

  /**
   * Returns the response of the given conditions
   * @param conditions
   * @param options
   */
  private async getResponse(
    conditions: IMongoConditions,
    options: INuOptions
  ): Promise<Promise<IModel>[]> {
    // get field selection
    const projection = {};
    options.select
      ?.filter(field => !field.includes("."))
      .forEach(field => (projection[field] = 1));

    // build population params
    if (options.populate?.length === 0) {
      options.populate = this.getReferenceVirtuals();
    }
    const populateOptions = await this.getPopulateParams(
      options.populate || [],
      Object.keys(projection),
      options.request
    );

    const cursors = await this.getMongoResponse(conditions, options);

    // hydrate and populate the response
    return cursors.map(model =>
      this.crudModel
        .hydrate(model)
        .populate(populateOptions)
        .execPopulate()
    );
  }
}
