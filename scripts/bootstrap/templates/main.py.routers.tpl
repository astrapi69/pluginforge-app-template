# BOOTSTRAP-ANCHOR-BEGIN: entity-routers
# This block is replaced by the bootstrap script in phase 4. To re-wire
# entity routers manually, list each router import + include_router call
# between the BEGIN and END markers. The bootstrap script will overwrite
# whatever sits between them on its next run.
from app.routers import (
    ${router_imports},
)

${include_router_lines}
# BOOTSTRAP-ANCHOR-END: entity-routers
