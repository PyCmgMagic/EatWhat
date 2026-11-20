import {
  commentReactionOptions,
  type CommentReactionType,
} from "../api/comments";

export function reactionSummary(
  choices: Record<number, CommentReactionType> = {},
  viewer?: number,
) {
  const votes = Object.values(choices);
  return commentReactionOptions.flatMap(({ reaction }) => {
    const count = votes.filter((vote) => vote === reaction).length;
    return count
      ? [
          {
            reaction,
            count,
            selected: viewer != null && choices[viewer] === reaction,
          },
        ]
      : [];
  });
}
