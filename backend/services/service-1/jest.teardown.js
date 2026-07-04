module.exports = async () => {
  // Give MongoDB connections time to close naturally
  await new Promise((resolve) => setTimeout(resolve, 100));
};
