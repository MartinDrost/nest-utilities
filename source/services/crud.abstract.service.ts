import { Request, Response } from "express";
import _isNil from "lodash/isNil";
import _mergeWith from "lodash/mergeWith";
import { ObjectID } from "mongodb";
import { Document, Model, ModelPopulateOptions } from "mongoose";
import { IMongoConditions } from "../interfaces";
import { IMongoRequest } from "../interfaces/mongoRequest.interface";

export abstract class CrudService<IModel extends Document> {
  constructor(protected crudModel: Model<IModel>) {}

  /**
   * Save a new modelItem
   * @param modelItem
   */
  public async create(modelItem: IModel, ...args: any[]): Promise<IModel> {
    // make sure no leftover id exists
    delete modelItem._id;
    delete modelItem.id;

    const model = await this.preSave(modelItem);
    return new this.crudModel(model).save();
  }

  /**
   * Create a modelItem if it doesn't exist, overwrite it otherwise
   * @param modelItem
   */
  public async createOrPut(modelItem: IModel, ...args: any[]): Promise<IModel> {
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
    if (ObjectID.isValid(id) === false) {
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
    if (mongoRequest.request) {
      // append conditions based on authorization
      mongoRequest.conditions = {
        ...mongoRequest.conditions,
        ...(await this.onAuthorizationRequest(mongoRequest.request))
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
      }
    }

    // build population params
    const selection = (mongoRequest.options || { select: [] }).select || [];
    const populateOptions = this.getPopulateParams(
      mongoRequest.populate || [],
      selection
    );

    return this.crudModel
      .find(mongoRequest.conditions, null, {
        ...mongoRequest.options,
        populate: undefined,

        // join the selection and filter out deep selections
        select: selection.filter(field => !field.includes(".")).join(" ")
      })
      .populate(populateOptions)
      .exec();
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
    if (ObjectID.isValid(id) === false) {
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
    picks: string[] = []
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
    return model.populate(this.getPopulateParams(paths, picks)).execPopulate();
  }

  /**
   * Populate a list of retrieved models
   * @param models
   */
  public populateList(models: IModel[]): Promise<IModel[]> {
    return Promise.all(models.map(model => this.populate(model)));
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

  private getPopulateParams(
    paths: string[],
    picks: string[] = []
  ): ModelPopulateOptions[] {
    const res = paths
      .map(path => this.deepPopulate(path, picks)!)
      .filter(param => param !== undefined);
    console.log(res);
    return res;
  }

  /**
   * Creates deep population options including select options
   *
   * @param path the current field including children
   * @param picks all picks defined in the select options
   * @param journey the passed fields so far
   */
  private deepPopulate(
    path: string,
    picks: string[],
    journey: string[] = []
  ): ModelPopulateOptions | undefined {
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
      populate:
        this.deepPopulate(pathParts.join("."), picks, [
          ...journey,
          currentPosition
        ]) || []
    };
  }

  /**
   * This method is called when the application requires Mongoose conditions
   * which imits the requesting user to content he/she is able to see.
   *
   * The request originates from Express and ideally contains a user object
   * to decide the right conditions.
   *
   * Override this method to use it.
   *
   * @param request
   */
  protected abstract async onAuthorizationRequest(
    request: Request
  ): Promise<IMongoConditions>;
}
