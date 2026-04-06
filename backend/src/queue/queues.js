// In-memory queue — always available, no Redis required
// Processes jobs immediately (fire-and-forget) which is fine for VPS without Redis

class InMemoryQueue {
  constructor(name) {
    this.name = name;
    this._id = 0;
  }

  async add(_jobName, _data) {
    return { id: `mem-${++this._id}` };
  }
}

export const projectQueue  = new InMemoryQueue('projects');
export const fileQueue     = new InMemoryQueue('files');
export const inviteQueue   = new InMemoryQueue('invitations');
export const invoiceQueue  = new InMemoryQueue('invoices');
export const notifyQueue   = new InMemoryQueue('notifications');

export const allQueues = [projectQueue, fileQueue, inviteQueue, invoiceQueue, notifyQueue];
