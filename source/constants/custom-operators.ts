export const customOperators: Record<
  string,
  (value: any) => Record<string, any>
> = {
  $not: (value: any) => value,
  $regex: (value: any) => value?.toString() ?? "",
  $options: (value: any) => value?.toString() ?? "",
  $isNull: (value: any) => {
    return ["true", true, "1", 1].includes(value)
      ? { $eq: null }
      : { $ne: null };
  },
};
