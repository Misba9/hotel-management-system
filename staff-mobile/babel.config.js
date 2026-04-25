module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      /** Must stay last when the project uses Reanimated. */
      "react-native-reanimated/plugin"
    ]
  };
};
