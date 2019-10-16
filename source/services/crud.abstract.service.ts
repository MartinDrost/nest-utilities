import _mergeWith from "lodash/mergeWith";
import _isNil from "lodash/isNil";
import { ObjectID } from "mongodb";
import { Document, Model } from "mongoose";
import { IMongoRequest } from "../interfaces/mongoRequest.interface";
import { Request, Response } from "express";
import { IMongoConditions } from "../interfaces";

export abstract class CrudService<IModel extends Document> {
  constructor(public crudModel: Model<IModel>) {}

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
   * Create a modelItem if it doesn't exist, update it otherwise
   * @param modelItem
   */
  public async createOrUpdate(
    modelItem: IModel,
    ...args: any[]
  ): Promise<IModel> {
    if (modelItem._id) {
      const existing = await this.get(modelItem._id);
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
    mongoRequest.options = { limit: 1 };

    return (await this.find(mongoRequest)[0]) || null;
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

    return this.crudModel
      .find(
        mongoRequest.conditions,
        mongoRequest.projection,
        mongoRequest.options
      )
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
    return this.crudModel
      .find(
        { ...mongoRequest.conditions, _id: ids },
        mongoRequest.projection,
        mongoRequest.options
      )
      .exec();
  }

  /**
   * Merge with an existing modelItem
   * @param modelItem
   */
  public async patch(
    modelItem: Partial<IModel>,
    ...args: any[]
  ): Promise<IModel> {
    const existing = await this.get(modelItem._id || "");
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

    return this.crudModel.update({ _id: model._id }, model).exec();
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
