import _ from "lodash";
import { ObjectID } from "mongodb";
import { Document, Model, ModelPopulateOptions } from "mongoose";

export abstract class CrudService<IModel extends Document> {
  constructor(private crudModel: Model<IModel>) {}

  /**
   * Save a new modelItem
   * @param modelItem
   */
  public async create(modelItem: IModel, ...args: any[]): Promise<IModel> {
    // make sure no leftover id exists
    delete modelItem._id;
    delete modelItem.id;

    modelItem = await this.preSave(modelItem);
    return new this.crudModel(modelItem).save();
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
   * Get all existing modelItems from the database
   */
  public getAll(...args: any[]): Promise<IModel[]> {
    return this.crudModel.find({ isRemoved: { $in: [false, null] } }).exec();
  }

  /**
   * Get a modelItem by its id
   * @param id
   */
  public async get(id: string, ...args: any[]): Promise<IModel | null> {
    if (ObjectID.isValid(id) === false) {
      return null;
    }

    return this.crudModel
      .findOne({ _id: id, isRemoved: { $in: [false, null] } })
      .exec();
  }

  /**
   * Find models by basic attribute selectors
   * @param options
   */
  public find(options: Partial<IModel>): Promise<IModel[]> {
    return this.crudModel.find(options).exec();
  }

  /**
   * Get a modelItem by its id
   * @param id
   */
  public async getMany(ids: string[], ...args: any[]): Promise<IModel[]> {
    const models = await this.crudModel
      .find({ _id: ids, isRemoved: { $in: [false, null] } })
      .exec();

    return _.flatten([models]);
  }

  /**
   * Merge with an existing modelItem
   * @param modelItem
   */
  public async patch(modelItem: IModel, ...args: any[]): Promise<IModel> {
    const existing = await this.get(modelItem._id);
    if (existing === null) {
      throw new Error("No model item found with the given id");
    }

    modelItem = JSON.parse(JSON.stringify(await this.preSave(modelItem)));

    // remove version number
    delete modelItem.__v;

    return _.mergeWith(existing, modelItem, (obj, src) =>
      !_.isNil(src) ? src : obj
    ).save();
  }

  /**
   * Overwrite the model item with the corresponding id
   * @param modelItem
   * @param args
   */
  public async put(modelItem: IModel, ...args: any): Promise<IModel> {
    modelItem = JSON.parse(JSON.stringify(await this.preSave(modelItem)));

    // remove version number
    delete modelItem.__v;

    return this.crudModel.update({ _id: modelItem._id }, modelItem).exec();
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
   * Hide a modelItem containing the given id
   * @param id
   */
  public hide(_id: string, ...args: any[]): Promise<IModel | null> {
    return this.patch({ _id, isRemoved: true, removedAt: new Date() } as any);
  }

  /**
   * Populate a list of modelItems
   * @param modelItem
   */
  public async populateList(
    modelItems: IModel[],
    ...args: any[]
  ): Promise<IModel[]> {
    const promises = [] as Promise<IModel>[];
    for (let i = 0, l = modelItems.length; i < l; i++) {
      promises[i] = this.populate(modelItems[i]);
    }

    return Promise.all(promises);
  }

  /**
   * Method which is called before create, patch or put is saved.
   * Override this method to use it.
   *
   * Be aware that the provided model can be incomplete because of patch requests.
   *
   * @param model
   */
  public async preSave(model: IModel): Promise<IModel> {
    return model;
  }

  /**
   * Populate the related data of the modelItem
   * @param modelItem
   * @param paths The path that ought to be populated
   * @param arrays All paths that should be arrays (optional)
   * @param match A match object (optional)
   * @param args
   */
  public populate(
    modelItem: IModel,
    paths: string[] = [],
    arrays: string[] = [],
    match: any = { isRemoved: { $in: [false, null] } },
    ...args: any[]
  ): Promise<IModel> {
    if (!modelItem) {
      return modelItem;
    }

    // create deep populated options
    const options: ModelPopulateOptions[] = [];
    for (const path of paths) {
      this.addOptions(path, options, match);
    }

    return modelItem
      .populate(options)
      .execPopulate()
      .then(model => {
        // change all undefined values to null
        for (const path of paths) {
          if (_.get(model, path) === undefined) {
            _.set(model, path, null);
          }
        }

        // remove unpopulated objectID's from populated arrays
        for (const array of arrays) {
          _.set(
            model,
            array,
            (_.get(model, array) || []).filter(
              (item: any) => item instanceof ObjectID === false
            )
          );
        }

        return model;
      });
  }

  /**
   * create populate options based on paths
   * @param path
   * @param layer
   * @param match
   */
  private addOptions(
    path: string,
    layer: ModelPopulateOptions[],
    match: any = { isRemoved: { $in: [false, null] } }
  ): void {
    // break the cycle if the path has ended
    if (!path) {
      return;
    }

    // separate the path in the current position and the journey ahead
    const dismembered = path.split(".");
    const position = dismembered.shift() as string;
    const journey = dismembered.join(".");

    // check if the current position has already been mapped
    for (let i = 0; i < layer.length; i++) {
      if (layer[i].path === position) {
        this.addOptions(journey, layer[i].populate as any, match);
        return;
      }
    }

    // add the position otherwise
    layer.unshift({
      match,
      path: position,
      populate: []
    });
    this.addOptions(journey, layer[0].populate as any, match);
  }
}
