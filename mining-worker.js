importScripts('https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js');
importScripts('https://cdn.jsdelivr.net/npm/argon2-browser@1.18.0/dist/argon2-bundled.min.js');

let mining = false;
let account, memory_cost, difficulty, worker_id;
const stored_targets = ['XEN11', 'XUNI'];

// Helper functions
function hash_value(value) {
    return CryptoJS.SHA256(value).toString();
}

function generate_random_sha256(max_length = 128) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    const random_string = Array.from({length: Math.floor(Math.random() * max_length) + 1}, () => characters[Math.floor(Math.random() * characters.length)]).join('');
    return CryptoJS.SHA256(random_string).toString();
}

function is_within_five_minutes_of_hour() {
    const now = new Date();
    const minutes = now.getMinutes();
    return minutes < 5 || minutes >= 55;
}

async function mine_block() {
    let attempts = 0;
    const remove_prefix_address = account.slice(2);
    const salt = CryptoJS.enc.Hex.parse(remove_prefix_address);

    while (mining) {
        attempts++;

        const random_data = generate_random_sha256();
        
        try {
            const result = await argon2.hash({
                pass: random_data,
                salt: salt.toString(),
                time: difficulty,
                mem: memory_cost,
                parallelism: 1,
                type: argon2.ArgonType.Argon2id,
                hashLen: 64
            });

            const hashed_data = result.hashHex;
            const last_87_chars = hashed_data.slice(-87);

            for (const target of stored_targets) {
                if (last_87_chars.includes(target)) {
                    if (target === 'XUNI' && /XUNI[0-9]/.test(hashed_data) && is_within_five_minutes_of_hour()) {
                        self.postMessage({
                            type: 'found',
                            hashed_data,
                            random_data,
                            attempts,
                            isSuperblock: false
                        });
                        break;
                    } else if (target === 'XEN11') {
                        const last_element = hashed_data.split('$').pop();
                        const hash_uppercase_only = last_element.replace(/[^A-Z]/g, '');
                        const isSuperblock = hash_uppercase_only.length >= 50;
                        
                        self.postMessage({
                            type: 'found',
                            hashed_data,
                            random_data,
                            attempts,
                            isSuperblock
                        });
                        break;
                    }
                }
            }
        } catch (error) {
            self.postMessage({ type: 'error', message: error.toString() });
            mining = false;
            break;
        }

        // update attempts to UI
        self.postMessage({ type: 'update', attempts });
    }
}

self.onmessage = function(e) {
    if (e.data.command === 'start') {
        account = e.data.account;
        memory_cost = e.data.memory_cost;
        difficulty = e.data.difficulty;
        worker_id = e.data.worker_id;
        mining = true;
        mine_block();
    } else if (e.data.command === 'stop') {
        mining = false;
    }
};
