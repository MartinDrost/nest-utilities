import { Body, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { Document } from "mongoose";

import { CrudPermissions } from "../../interfaces/crudPermissions.interface";
import { Permission } from "../decorators/permission.decorator";
import { PermissionGuard } from "../guards/permission.guard";
import { CrudService } from "../services/crud.abstract.service";

@UseGuards(PermissionGuard)
export abstract class CrudController<IModel extends Document> {
  constructor(
    private service: CrudService<IModel>,
    public permissions: CrudPermissions
  ) {}

  @Post()
  @Permission()
  async create(@Body() model: IModel, ...args: any[]): Promise<IModel> {
    const created = await this.service.create(model as IModel);
    return await this.service.populate(created);
  }

  @Get()
  @Permission()
  async getAll(...args: any[]): Promise<IModel[]> {
    return await this.service.getAll();
  }

  @Get(":id")
  @Permission()
  async get(@Param() params: any, ...args: any[]): Promise<IModel> {
    const fetched = await this.service.get(params.id);
    return await this.service.populate(fetched as IModel);
  }

  @Get("many/:ids")
  @Permission()
  async getMany(@Param() params: any, ...args: any[]): Promise<IModel[]> {
    const fetched = await this.service.getMany(params.ids.split(","));
    return await this.service.populateList(fetched);
  }

  @Put()
  @Permission()
  async update(@Body() model: IModel, ...args: any[]): Promise<IModel> {
    const updated = await this.service.update(model as IModel);
    return await this.service.populate(updated);
  }

  @Delete(":id")
  @Permission()
  async delete(@Param() params: any, ...args: any[]): Promise<IModel> {
    const deleted = await this.service.delete(params.id);
    return await this.service.populate(deleted as IModel);
  }
}
