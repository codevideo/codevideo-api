package utils

import (
	"fmt"
	"math"

	"github.com/shirou/gopsutil/v3/mem"
)

// GetRAMUsage returns the percentage of used RAM.
func GetRAMUsage() (string, error) {
	vmStat, err := mem.VirtualMemory()
	if err != nil {
		return "0", err
	}

	return fmt.Sprintf("%.0f", math.Round(vmStat.UsedPercent)), nil
}
