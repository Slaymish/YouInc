import {
  emptyQuizState,
  parseQuizState,
  serializeQuizState,
  QUIZ_STORAGE_KEY,
  type QuizState,
} from "./quizModel";

export function loadQuizState(): QuizState {
  try {
    return parseQuizState(localStorage.getItem(QUIZ_STORAGE_KEY)) ?? emptyQuizState();
  } catch {
    return emptyQuizState();
  }
}

export function persistQuizState(state: QuizState): void {
  try {
    localStorage.setItem(QUIZ_STORAGE_KEY, serializeQuizState(state));
  } catch {
    /* ignore quota / unavailable */
  }
}

export function clearQuizState(): void {
  try {
    localStorage.removeItem(QUIZ_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
