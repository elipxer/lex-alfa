"""Windowless entry point bundled in the CCX. Never launches a terminal."""
import sys
from processor.runtime import record_startup_error
from processor.server import main

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        record_startup_error(error)
        sys.exit(1)
