from .checks import Ctx


async def execute(test, guardian):
    """Attack run, then an independent confirmation on different objects/actors. Never trusts the first result alone."""
    c = Ctx(guardian, test.id)
    first = await test.run(c)
    first.trace = list(c.trace)
    if not first.reproduced:
        return None
    c.trace.clear()
    second = await test.verify(c)
    second.trace = list(c.trace)
    if not first.control_ok:
        status, conf, why = "False Positive", 0.2, "baseline control request failed; result likely caused by an unrelated error"
    elif second.reproduced:
        status, conf, why = "Verified", 0.95, "reproduced, then independently confirmed on a different object/actor"
    else:
        status, conf, why = "Needs Review", 0.5, "reproduced once but not confirmed by independent check"
    return dict(status=status, confidence=conf, reason=why, first=first, second=second)
