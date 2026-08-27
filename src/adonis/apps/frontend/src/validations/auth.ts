export const validateEmail = (value: string) =>
  /^\S+@\S+$/.test(value) ? null : "Invalid email";

export const validatePassword = (value: string) => {
  const length = value.trim().length;
  if (length < 8) {
    return "Password too short";
  }
  if (length > 32) {
    return "Password too long";
  }
  return null;
};
