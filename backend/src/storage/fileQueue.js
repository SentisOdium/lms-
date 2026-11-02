/**
 * File Write Queue
 * Ensures asynchronous operations on the same file path are executed sequentially.
 */

class FileQueue {
  constructor() {
    this.queues = new Map();
  }

  /**
   * Enqueue an async task for a specific file key
   * @param {string} key - File path or identifier
   * @param {() => Promise<any>} task - Async function to execute
   * @returns {Promise<any>}
   */
  enqueue(key, task) {
    if (!this.queues.has(key)) {
      this.queues.set(key, Promise.resolve());
    }

    const currentPromise = this.queues.get(key);
    const nextPromise = currentPromise
      .then(async () => {
        try {
          return await task();
        } finally {
          // If queue settled and nothing is chained, clean up key
          if (this.queues.get(key) === nextPromise) {
            this.queues.delete(key);
          }
        }
      })
      .catch((err) => {
        if (this.queues.get(key) === nextPromise) {
          this.queues.delete(key);
        }
        throw err;
      });

    this.queues.set(key, nextPromise);
    return nextPromise;
  }
}

export const fileQueue = new FileQueue();

