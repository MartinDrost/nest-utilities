import { NotFoundException } from "@nestjs/common";
import { Conditions, CrudService } from "fundering";
import { IExpressQueryOptions } from "../interfaces/express-query-options.interface";
import { IModel } from "../interfaces/model.interface";
import { addCountHeaderHook } from "../utilities/controller.utilities";

export abstract class CrudController<ModelType extends IModel> {
  constructor(private crudService: CrudService<ModelType>) {
    addCountHeaderHook(this.crudService);
  }

  /**
   * Handles create requests
   * @param model
   * @param options
   */
  handleCreate(
    model: ModelType,
    options?: IExpressQueryOptions
  ): Promise<ModelType> {
    return this.crudService.create(model, options);
  }

  /**
   * Handles create requests for creating multiple models at once
   * @param models
   * @param options
   */
  handleCreateMany(
    models: ModelType[],
    options?: IExpressQueryOptions
  ): Promise<ModelType[]> {
    return this.crudService.createMany(models, options);
  }

  /**
   * Handles find requests
   * @param conditions
   * @param options
   */
  async handleFind(
    conditions: Conditions,
    options?: IExpressQueryOptions
  ): Promise<ModelType[]> {
    await this.crudService.count(conditions, options);
    return this.crudService.find(conditions, options);
  }

  /**
   * Handles find by id requests
   * @param id
   * @param options
   */
  async handleFindById(
    id: string,
    options?: IExpressQueryOptions
  ): Promise<ModelType> {
    const model = await this.crudService.findById(id, options);
    if (!model) {
      throw new NotFoundException("No model found");
    }

    return model;
  }

  /**
   * Handles put requests
   * @param id
   * @param model
   * @param options
   */
  async handlePut(
    model: ModelType,
    id?: string,
    options?: IExpressQueryOptions
  ): Promise<ModelType> {
    if (id) {
      model._id = model.id = id;
    }
    await this.handleFindById(model._id || model.id, {
      request: options?.request,
    });

    return this.crudService.replaceModel(model, options);
  }

  /**
   * Handles put requests for replacing multiple models at once
   * @param model
   * @param options
   */
  async handlePutMany(
    models: ModelType[],
    options?: IExpressQueryOptions
  ): Promise<ModelType[]> {
    // check if all models can be found by the requester
    await Promise.all(
      models.map(async (model) => {
        model._id = model._id || model.id;
        model.id = model._id;
        await this.handleFindById(model._id, {
          request: options?.request,
        });
      })
    );

    return this.crudService.replaceModels(models, options);
  }

  /**
   * Handles patch requests
   * @param id
   * @param model
   * @param options
   */
  async handlePatch(
    model: Partial<ModelType>,
    id?: string,
    options?: IExpressQueryOptions
  ): Promise<ModelType> {
    if (id) {
      model._id = model.id = id;
    }
    await this.handleFindById(model._id || model.id || "", {
      request: options?.request,
    });

    return this.crudService.mergeModel(model, options);
  }

  /**
   * Handles patch requests for merging multiple models at once
   * @param model
   * @param options
   */
  async handlePatchMany(
    models: Partial<ModelType>[],
    options?: IExpressQueryOptions
  ): Promise<ModelType[]> {
    // check if all models can be found by the requester
    await Promise.all(
      models.map(async (model) => {
        model._id = model._id || model.id;
        model.id = model._id;
        await this.handleFindById(model._id || "", {
          request: options?.request,
        });
      })
    );

    return this.crudService.mergeModels(models || [], options);
  }

  /**
   * Handles delete requests
   * @param id
   * @param options
   */
  async handleDelete(
    id: string,
    options?: IExpressQueryOptions
  ): Promise<ModelType | null> {
    await this.handleFindById(id, { request: options?.request });
    return this.crudService.deleteById(id, options);
  }
}
