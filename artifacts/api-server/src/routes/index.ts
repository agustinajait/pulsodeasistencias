import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import centersRouter from "./centers";
import roomsRouter from "./rooms";
import childrenRouter from "./children";
import attendanceRouter from "./attendance";
import contactsRouter from "./contacts";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(centersRouter);
router.use(roomsRouter);
router.use(childrenRouter);
router.use(attendanceRouter);
router.use(contactsRouter);
router.use(dashboardRouter);

export default router;
