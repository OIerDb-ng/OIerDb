// "NOI2017D类" -> "NOI2017 D类"
export default function fixContestName(contestName: string) {
  return contestName.replace(/(\d+)([a-z]+)/gi, '$1 $2');
}
