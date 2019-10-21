import { Request, Response } from "express";
import _isNil from "lodash/isNil";
import _mergeWith from "lodash/mergeWith";
import { Document, Model, ModelPopulateOptions } from "mongoose";
import { IMongoConditions } from "../interfaces";
import { IMongoRequest } from "../interfaces/mongoRequest.interface";
import { isObjectID } from "../utilities";

export abstract class CrudService<IModel extends Document> {
  private static serviceMap: { [modelName: string]: CrudService<any> } = {};

  constructor(protected crudModel: Model<IModel>) {
    CrudService.serviceMap[crudModel.modelName] = this;
  }

  /**
   * Save a new modelItem
   * @param modelItem
   */
  public async create(
    modelItem: Omit<IModel, keyof Document>,
    ...args: any[]
  ): Promise<IModel> {
    // make sure no leftover id exists
    delete modelItem["_id"];
    delete modelItem["id"];

    const model = await this.preSave(modelItem as IModel);
    return new this.crudModel(model).save();
  }

  /**
   * Create a modelItem if it doesn't exist, merge it otherwise
   * @param modelItem
   */
  public async createOrPatch(
    modelItem: IModel,
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
    mongoRequest: IMongoRequest = {},
    ...args: any[]
  ): Promise<IModel | null> {
    if (isObjectID(id) === false) {
      return null;
    }

    mongoRequest.conditions = { ...mongoRequest.conditions, _id: id };

    return this.findOne(mongoRequest);
  }

  /**
   * Find a single model
   * @param mongoRequest
   */
  public async findOne(
    mongoRequest: IMongoRequest = {}
  ): Promise<IModel | null> {
    mongoRequest.options = { ...mongoRequest.options, limit: 1 };

    const response = await this.find(mongoRequest);
    if (response.length) {
      return response[0];
    }

    return null;
  }

  /**
   * Find models
   * @param options
   */
  public async find(mongoRequest: IMongoRequest = {}): Promise<IModel[]> {
    //disable cast errors
    const types = Object.keys(this.crudModel.base.SchemaTypes);
    const validators: { [type: string]: Function } = {};

    types.forEach(type => {
      const schemaType = this.crudModel.base[type];
      if (schemaType && schemaType.cast) {
        validators[type] = schemaType.cast();
        schemaType.cast(v => {
          try {
            return validators[type](v);
          } catch (e) {
            return v;
          }
        });
      }
    });

    if (mongoRequest.request) {
      // append conditions based on authorization
      mongoRequest.conditions = {
        ...mongoRequest.conditions,
        ...(await this.onFindRequest(mongoRequest.request, {
          $and: [{}],
          ...mongoRequest.conditions
        }))
      };

      if (mongoRequest.request.context) {
        // store the amount of documents without limit in a response header
        const response = mongoRequest.request.context
          .switchToHttp()
          .getResponse<Response>();

        const numberOfDocuments = await this.crudModel
          .countDocuments(mongoRequest.conditions)
          .exec();

        response.header("X-total-count", numberOfDocuments.toString());
        response.header("Access-Control-Expose-Headers", [
          "X-total-count",
          (response.getHeader("Access-Control-Expose-Headers") || "").toString()
        ]);
      }
    }

    // build population params
    const selection = (mongoRequest.options || { select: [] }).select || [];
    const populateOptions = await this.getPopulateParams(
      mongoRequest.populate || [],
      selection,
      mongoRequest.request
    );

    // execute the find query
    const response = await this.crudModel
      .find(mongoRequest.conditions, null, {
        ...mongoRequest.options,
        populate: undefined,

        // join the selection and filter out deep selections
        select: selection.filter(field => !field.includes(".")).join(" ")
      })
      .populate(populateOptions)
      .exec();

    // enable cast errors
    Object.keys(validators).forEach(type =>
      this.crudModel.base[type].cast(validators[type])
    );

    return response;
  }

  /**
   * Get multiple modelItems by their id
   * @param id
   */
  public getMany(
    ids: string[],
    mongoRequest: IMongoRequest = {},
    ...args: any[]
  ): Promise<IModel[]> {
    mongoRequest.conditions = { ...mongoRequest.conditions, _id: ids };
    return this.find(mongoRequest);
  }

  /**
   * Merge with an existing modelItem
   * @param modelItem
   */
  public async patch(
    modelItem: Partial<IModel>,
    ...args: any[]
  ): Promise<IModel> {
    const existing = await this.get(modelItem._id || modelItem.id || "");
    if (existing === null) {
      throw new Error("No model item found with the given id");
    }

    modelItem = await this.preSave(modelItem);

    // remove version number
    delete modelItem.__v;

    return _mergeWith(existing, modelItem, (obj, src) =>
      !_isNil(src) ? src : obj
    ).save();
  }

  /**
   * Overwrite the model item with the corresponding id
   * @param modelItem
   * @param args
   */
  public async put(modelItem: IModel, ...args: any): Promise<IModel> {
    const model = await this.preSave(modelItem);

    // remove version number
    delete model.__v;

    return this.crudModel.update({ _id: model._id || model.id }, model).exec();
  }

  /**
   * Delete a modelItem by its id
   * @param id
   */
  public async delete(id: string, ...args: any[]): Promise<IModel | null> {
    if (isObjectID(id) === false) {
      return null;
    }

    return this.crudModel.findByIdAndRemove(id).exec();
  }

  /**
   * Find models and delete them
   * @param conditions
   */
  public async findAndDelete(
    conditions: Partial<IModel>
  ): Promise<(IModel | null)[]> {
    const found = await this.find({ conditions });

    return await Promise.all(found.map(model => this.delete(model._id)!));
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
    return this.crudModel.schema.obj;
  }

  /**
   * Populate a retrieved model
   * @param model
   */
  public async populate(
    model: IModel,
    paths: string[] = [],
    picks: string[] = [],
    request?: Request
  ): Promise<IModel> {
    if (!model.populate) {
      if (!model._id && !model.id) {
        return model;
      } else {
        return (await this.get(model._id || model._id, {
          populate: []
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
  public populateList(models: IModel[]): Promise<IModel[]> {
    return Promise.all(models.map(model => this.populate(model)));
  }

  /**
   * Build and return recursive populate() params for Mongoose
   * @param paths
   * @param picks
   */
  private async getPopulateParams(
    paths: string[],
    picks: string[] = [],
    request?: Request
  ): Promise<ModelPopulateOptions[]> {
    return (await Promise.all(
      paths.map(path => this.deepPopulate(path, picks, request))
    )).filter(param => param !== undefined) as ModelPopulateOptions[];
  }

  /**
   * Creates deep population options including select options
   *
   * @param path the current field including children
   * @param picks all picks defined in the select options
   * @param journey the passed fields so far
   */
  private async deepPopulate(
    path: string,
    picks: string[],
    request?: Request,
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
      match: this.getPopulateMatch(
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
  private async getPopulateMatch(path: string, request?: Request) {
    if (!request) {
      return {};
    }
    return CrudService.serviceMap["abc"].onFindRequest(request, { $and: [] });
  }

  /**
   * Method which is called before create, patch or put is saved.
   * Override this method to use it.
   *
   * Be aware that the provided model can be incomplete because of patch requests.
   *
   * @param model
   */
  public async preSave(model: Partial<IModel>): Promise<Partial<IModel>> {
    return model;
  }

  /**
   * This method is called when the application requires Mongoose conditions
   * which limits the requesting user to content he/she is able to see.
   * When writing the authorization conditions you should take the conditions
   * parameter into account since it originates from another point in the
   * application. The object should therefore be extended instead of overwritten.
   *
   * The request originates from Express and ideally contains a user object
   * to decide the right conditions.
   *
   * Override this method to use it.
   *
   * @param request the Express request originating from the controller
   * @param conditions already set conditions to be extended upon
   */
  public abstract async onFindRequest(
    request: Request | any,
    conditions: IMongoConditions
  ): Promise<IMongoConditions>;
}
