export const validateEmail = (value: string) =>
  /^\S+@\S+$/.test(value) ? null : "Invalid email";

export const validatePassword = (value: string) =>
  value.trim().length < 8 ? "Password too short" : null;
