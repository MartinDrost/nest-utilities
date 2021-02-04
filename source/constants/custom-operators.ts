export const customOperators: Record<
  string,
  (value: any) => Record<string, any>
> = {
  $isNull: (value: any) => {
    return ["true", true, "1", 1].includes(value)
      ? { $eq: null }
      : { $ne: null };
  },
};
