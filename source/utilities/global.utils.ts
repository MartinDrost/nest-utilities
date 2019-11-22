import { INestApplication } from "@nestjs/common";
import { ObjectId } from "bson";
import { ContextInterceptor } from "../interceptors";

/**
 * Initiates basic functionality to use nest-utilities
 * @param app
 */
export const initNestUtilities = (app: INestApplication | any) => {
  app.useGlobalInterceptors(new ContextInterceptor());
};

/**
 * Validates if the given value is an object ID
 */
export const isObjectID = (v: string | ObjectId) =>
  /^[0-9a-fA-F]{24}$/.test(v + "");

/**
 * Returns the keys of an object recursively.
 * {a: { b: { c: 1 } d: 1 }, e: [{ f: 1 }], g: 1}
 * returns: ['a', 'a.b', 'a.b.c', 'a.d', 'e', 'e.f', 'g']
 * @param object
 * @param stack
 * @param path
 */
export const getDeepKeys = (
  object: Object,
  stack: string[] = [],
  path: string[] = []
) => {
  if (object && typeof object === "object" && !Array.isArray(object)) {
    for (const key of Object.keys(object)) {
      // skip empty keys caused by keys ending with '.'
      if (!key) {
        continue;
      }

      // branch off the path and add to the stack
      const branch = [...path];
      stack.push([...branch, key].join("."));
      branch.push(key);

      // call self on array and object children
      const value = object[key];
      if (Array.isArray(value)) {
        value.forEach(item => getDeepKeys(item, stack, [...branch]));
      } else if (typeof value === "object") {
        getDeepKeys(value, stack, [...branch]);
      }
    }
  }

  return stack;
};
