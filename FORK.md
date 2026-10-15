# Local filament support fork

Based on Bambu Studio `v02.08.04.57`, under the existing AGPLv3 license.
The selection resolver is adapted from JaKuBisz's
[upstream PR12060](https://github.com/bambulab/BambuStudio/pull/12060).

Manually registered rolls can resolve an existing filament ID, a mistakenly saved
cloud setting ID, an unambiguous vendor/material profile, or a compatible Generic
material. Printer compatibility remains enforced. Unknown materials remain
unsupported; ambiguous vendor formulations use the Generic polymer instead of
selecting an arbitrary formulation. Existing valid profiles retain priority.

Optional local inventory caching is enabled only when the launcher supplies
`BAMBU_FORK_LOCAL_INVENTORY` with an explicit private JSON file path. The cache
uses schema1 with a `spools` array of Studio's serialized spool objects. Startup
restores the file; panel updates and normal shutdown save it atomically with
owner-only file permissions. Duplicate/empty identities and malformed caches are
rejected. Without that variable, upstream cloud-only storage behavior remains.
This local cache uses the same physical/cloud IDs and does not create cloud rolls.

Automatic slice-based consumption deductions from the community PR are excluded.
They require separate handling of Auto-Refill, job identity, retries, physical roll
changes and already-accounted usage before becoming dependable.

## Shared local inventory

An optional trusted executable selected by `BAMBU_FORK_SHARED_INVENTORY` replaces
the independent cloud/cache inventory with a shared backend. Studio invokes it
directly with argv and private request/response files, never a shell. The JSON
request contains `base` and `current` native spool arrays; the reply contains
`ok`, canonical `spools`, and an optional error. The backend applies field changes
with optimistic conflict checks and returns the authoritative current snapshot.
Failed edits restore the acknowledged view. No cloud inventory writes or automatic
AMS stock reconciliation run in this mode; printer controls remain separate.

The Filament Manager refreshes from that backend every two seconds. Spool create,
edit and archive operations use the same path. A companion widget can read/write
the same canonical register under the same lock, without a copied stock database.
Local profile metadata remains separate from canonical grams and slot locations.
The Plasma-UI `studio_inventory.py` adapter implements this contract with its
existing `roll_data.py` backend. Configure its private `shared_config.json` before
packaging; the installer adds the helper and config environment to the launcher.
The original cache remains a rollback snapshot when shared mode is disabled.

## Build and test on Linux

An existing Docker installation is required. No host package installation or sudo
is used. The Ubuntu24 dependency image builds libraries separately and caches
partial dependency builds for retries:

```sh
docker build -f docker/BuildForkDependencies.Dockerfile -t joseph-bambustudio-deps:2.8.4 .
docker/build-fork.sh /absolute/private/build-directory
```

The second command builds Studio and runs the focused profile-resolution and
inventory-cache tests. Profiles, credentials, live inventory, printer identifiers
and private build/runtime data belong outside this repository. Do not include them
in commits, image contexts or published artifacts.

After those checks pass, install the built executable and resources into a copy
of the matching official Linux runtime, leaving the original installation intact:

```sh
python3 docker/package-fork.py /absolute/private/build-directory /absolute/extracted-official-runtime /absolute/private/fork-runtime
```

This checks runtime library resolution and adds the **Bambu Studio Fork** menu
entry. The launcher uses the separate `~/.config/BambuStudioFork` profile and its
optional private inventory cache. Back up and copy an existing compatible profile
before launching; the packaging script does not migrate accounts or inventory.
