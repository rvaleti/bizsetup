import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import companiesRouter from "./companies";
import pipelinesRouter from "./pipelines";
import eventsRouter from "./events";
import notificationsRouter from "./notifications";
import usersRouter from "./users";
import adminRouter from "./admin";
import sseRouter from "./sse";
import docsRouter from "./docs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(companiesRouter);
router.use(pipelinesRouter);
router.use(eventsRouter);
router.use(notificationsRouter);
router.use(usersRouter);
router.use(adminRouter);
router.use(sseRouter);
router.use(docsRouter);

export default router;
