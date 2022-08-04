const getProgress = (score: number, fullScore: number) => {
  if (score >= fullScore) return 10;
  if (score < 0) return 0;
  return Math.floor((10 * score) / fullScore);
};

export default getProgress;
