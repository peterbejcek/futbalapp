// babel-preset-expo obsahuje podporu expo-router (file-based routing).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
