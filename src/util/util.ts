/**
 * Sleep function.
 * @param ms Num of milliseconds to wait
 * @returns Promise that resolves after the specified time
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export const sleepModule = {sleep}