#!/usr/bin/env python3
"""Resource-only sampler: never records command lines or environment values."""
import argparse,json,os,signal,time
from pathlib import Path
stop=False
def finish(*_):
 global stop
 stop=True
signal.signal(signal.SIGTERM,finish);signal.signal(signal.SIGINT,finish)
def integers(path):
 try:return {x.split()[0]:int(x.split()[1]) for x in Path(path).read_text().splitlines()}
 except (OSError,ValueError,IndexError):return {}
def processes():
 groups={k:{'count':0,'rss_bytes_sum':0,'cpu_ticks_sum':0} for k in ['chromium','node']}
 for d in Path('/proc').glob('[0-9]*'):
  try:
   name=(d/'comm').read_text().strip()
   try:executable=Path(os.readlink(d/'exe')).name
   except OSError:executable=''
   group='chromium' if name.startswith(('chromium','chrome')) else 'node' if name=='node' or executable in ('node','nodejs') else None
   if not group:continue
   stat=(d/'stat').read_text().split(') ',1)[1].split();rss=int((d/'statm').read_text().split()[1])*os.sysconf('SC_PAGE_SIZE')
   g=groups[group];g['count']+=1;g['rss_bytes_sum']+=rss;g['cpu_ticks_sum']+=int(stat[11])+int(stat[12])
  except (OSError,ValueError,IndexError):pass
 return groups
def main(a):
 p=Path(a.output);p.parent.mkdir(parents=True,exist_ok=True);p.chmod(0o700) if p.exists() else None
 quota=Path('/sys/fs/cgroup/cpu.max').read_text().split();cores=None if quota[0]=='max' else int(quota[0])/int(quota[1])
 limit=Path('/sys/fs/cgroup/memory.max').read_text().strip();limit=None if limit=='max' else int(limit)
 samples=[];start=time.monotonic()
 while not stop:
  try:mem=int(Path('/sys/fs/cgroup/memory.current').read_text())
  except (OSError,ValueError):mem=None
  samples.append({'elapsed_s':round(time.monotonic()-start,2),'cgroup_memory_bytes':mem,'cgroup_cpu':integers('/sys/fs/cgroup/cpu.stat'),'cgroup_memory_events':integers('/sys/fs/cgroup/memory.events'),'process_groups':processes()})
  p.write_text(json.dumps({'scope':'local generator and app share executor; process RSS sum may count shared pages repeatedly','cpu_quota_cores':cores,'memory_limit_bytes':limit,'clock_ticks_per_second':os.sysconf('SC_CLK_TCK'),'samples':samples},indent=2))
  for _ in range(max(1,int(a.interval*10))):
   if stop:break
   time.sleep(.1)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--interval',type=float,default=5);main(p.parse_args())
