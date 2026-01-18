# HSM Operational Profile

This document outlines the operational profile for the myid-hsm service, including Vault configuration, role separation, and administrative endpoints.

## Vault Schema

The HSM service uses the following Vault paths to store its configuration and secrets.

### Configuration

-   **Path:** `c3-hsm/myid-hsm/config`
-   **Fields:**
    -   `hsm_host`: The hostname or IP address of the HSM.
    -   `enabled_slots`: A JSON array of slot IDs that are enabled for use (e.g., `["0000", "0001"]`).
    -   `default_slot`: The default slot to be used for signing operations.
    -   `p11tool2_cmd`: The path to the `p11tool2-remote` executable.
    -   `csadm_cmd`: The path to the `csadm-remote` executable.

### Slot Credentials

-   **Path:** `c3-hsm/slot_XXXX` (where `XXXX` is the 4-digit slot ID)
-   **Fields:**
    -   `so_pin`: The Security Officer (SO) PIN for the slot.
    -   `usr_pin`: The User (USR) PIN for the slot.
    -   `km_pin`: (Optional) The Key Manager (KM) PIN for the slot.

### Admin Credentials

-   **Path:** `c3-hsm/myid-hsm/admin`
-   **Fields:**
    -   `admin_op_key`: A secret key that must be provided in the `X-Admin-Op` header for administrative operations.

## Role Separation

The HSM service enforces strict role separation to enhance security:

-   **User Role (USR):** All standard cryptographic operations (e.g., signing) are performed using the `USR_<slot>` user and the corresponding `usr_pin`. The `usr_pin` is never exposed outside of the `hsm-session` module.
-   **Security Officer Role (SO):** Administrative operations are performed using the `SO_<slot>` user and the corresponding `so_pin`. The `so_pin` is only used within the `/api/hsm/admin/*` endpoints.

## Administrative Endpoints

The following administrative endpoints are available under the `/api/hsm/admin` path. All endpoints require a valid API key and the `X-Admin-Op` header.

-   **`GET /api/hsm/admin/users`**
    -   **Description:** Lists all users on the HSM.
    -   **Command:** `csadm-remote listuser`
-   **`GET /api/hsm/admin/slots`**
    -   **Description:** Lists all available slots on the HSM.
    -   **Command:** `p11tool2-remote ListSlots`
-   **`GET /api/hsm/admin/objects?slot=XXXX`**
    -   **Description:** Lists all objects in the specified slot.
    -   **Command:** `p11tool2-remote ListObjects`
