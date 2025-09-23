import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";

interface CallData {
  to: string;
  from: string;
  channelName?: string;
}

interface GroupRoom {
  id: string;
  name: string;
  creator: string;
  participants: string[];
  maxParticipants: number;
  createdAt: Date;
}

@WebSocketGateway({
  cors: {
    origin: "http://localhost:4200",
    methods: ["GET", "POST"],
    credentials: true,
  },
})
export class VideoCallGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VideoCallGateway.name);
  private connectedUsers = new Map<string, string>(); // userId -> socketId
  private groupRooms = new Map<string, GroupRoom>(); // roomId -> room

  handleConnection(client: Socket) {
    this.logger.log(`🔌 Клиент подключен: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    // Находим и удаляем пользователя
    for (const [userId, socketId] of this.connectedUsers.entries()) {
      if (socketId === client.id) {
        this.connectedUsers.delete(userId);
        this.logger.log(`👋 Пользователь ${userId} отключен`);
        break;
      }
    }
  }

  @SubscribeMessage("register")
  handleRegister(
    @MessageBody() userId: string,
    @ConnectedSocket() client: Socket,
  ) {
    this.connectedUsers.set(userId, client.id);
    this.logger.log(
      `📝 Пользователь ${userId} зарегистрирован с сокетом ${client.id}`,
    );

    client.emit("registered", { success: true, userId });
  }

  @SubscribeMessage("call_invite")
  handleCallInvite(
    @MessageBody() data: CallData,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`📞 Входящий вызов от ${data.from} к ${data.to}`);

    const targetSocketId = this.connectedUsers.get(data.to);

    if (targetSocketId) {
      // Отправляем приглашение целевому пользователю
      this.server.to(targetSocketId).emit("call_invite", {
        from: data.from,
        to: data.to,
        channelName: data.channelName || "lesson_channel",
      });

      this.logger.log(`✅ Приглашение отправлено пользователю ${data.to}`);
    } else {
      // Пользователь не в сети
      client.emit("call_failed", {
        reason: "user_offline",
        targetUser: data.to,
      });

      this.logger.warn(`⚠️ Пользователь ${data.to} не в сети`);
    }
  }

  @SubscribeMessage("call_accept")
  handleCallAccept(@MessageBody() data: CallData) {
    this.logger.log(`✅ Пользователь ${data.from} принял вызов от ${data.to}`);

    const initiatorSocketId = this.connectedUsers.get(data.to);

    if (initiatorSocketId) {
      // Уведомляем инициатора о принятии вызова
      this.server.to(initiatorSocketId).emit("call_accept", {
        from: data.from,
        to: data.to,
        channelName: data.channelName || "lesson_channel",
      });

      this.logger.log(`📢 Инициатор ${data.to} уведомлен о принятии вызова`);
    }
  }

  @SubscribeMessage("call_reject")
  handleCallReject(@MessageBody() data: CallData) {
    this.logger.log(
      `❌ Пользователь ${data.from} отклонил вызов от ${data.to}`,
    );

    const initiatorSocketId = this.connectedUsers.get(data.to);

    if (initiatorSocketId) {
      // Уведомляем инициатора об отклонении вызова
      this.server.to(initiatorSocketId).emit("call_reject", {
        from: data.from,
        to: data.to,
        reason: "user_declined",
      });

      this.logger.log(`📢 Инициатор ${data.to} уведомлен об отклонении вызова`);
    }
  }

  @SubscribeMessage("call_end")
  handleCallEnd(@MessageBody() data: CallData) {
    this.logger.log(`🔴 Звонок завершен между ${data.from} и ${data.to}`);

    // Уведомляем обе стороны о завершении звонка
    const targetSocketId = this.connectedUsers.get(data.to);
    const fromSocketId = this.connectedUsers.get(data.from);

    if (targetSocketId) {
      this.server.to(targetSocketId).emit("call_ended", { from: data.from });
    }

    if (fromSocketId) {
      this.server.to(fromSocketId).emit("call_ended", { from: data.to });
    }
  }

  // Метод для получения списка онлайн пользователей (для админ панели)
  @SubscribeMessage("get_online_users")
  handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    const onlineUsers = Array.from(this.connectedUsers.keys());
    client.emit("online_users", onlineUsers);

    this.logger.log(
      `📊 Отправлен список онлайн пользователей: ${onlineUsers.length} человек`,
    );
  }

  // === ГРУППОВЫЕ КОНФЕРЕНЦИИ ===

  @SubscribeMessage("room_created")
  handleRoomCreated(@MessageBody() data: { room: GroupRoom; creator: string }) {
    this.logger.log(
      `🏫 Создана комната: ${data.room.name} (${data.room.id}) пользователем ${data.creator}`,
    );

    // Сохраняем комнату
    this.groupRooms.set(data.room.id, data.room);

    // Уведомляем всех о новой комнате
    this.server.emit("room_created", { room: data.room });

    this.logger.log(
      `💾 Комната сохранена. Всего комнат: ${this.groupRooms.size}`,
    );
  }

  @SubscribeMessage("join_room_request")
  handleJoinRoomRequest(
    @MessageBody() data: { roomId: string; userId: string; userName: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(
      `🚪 Запрос на присоединение к комнате ${data.roomId} от ${data.userId}`,
    );

    const room = this.groupRooms.get(data.roomId);

    if (!room) {
      client.emit("room_join_failed", { reason: "Комната не найдена" });
      this.logger.warn(`❌ Комната ${data.roomId} не найдена`);
      return;
    }

    if (room.participants.length >= room.maxParticipants) {
      client.emit("room_join_failed", { reason: "Комната переполнена" });
      this.logger.warn(`❌ Комната ${data.roomId} переполнена`);
      return;
    }

    if (room.participants.includes(data.userId)) {
      client.emit("room_join_failed", { reason: "Вы уже в этой комнате" });
      this.logger.warn(
        `❌ Пользователь ${data.userId} уже в комнате ${data.roomId}`,
      );
      return;
    }

    // Добавляем участника
    room.participants.push(data.userId);
    this.groupRooms.set(data.roomId, room);

    // Подтверждаем присоединение
    client.emit("room_joined", { room });

    // Уведомляем других участников
    room.participants.forEach((participantId) => {
      if (participantId !== data.userId) {
        const participantSocketId = this.connectedUsers.get(participantId);
        if (participantSocketId) {
          this.server.to(participantSocketId).emit("room_participant_joined", {
            participant: data.userId,
            participantName: data.userName,
          });
        }
      }
    });

    this.logger.log(
      `✅ Пользователь ${data.userId} присоединился к комнате ${data.roomId}. Участников: ${room.participants.length}`,
    );
  }

  @SubscribeMessage("leave_room")
  handleLeaveRoom(@MessageBody() data: { roomId: string; userId: string }) {
    this.logger.log(
      `🚪 Пользователь ${data.userId} покидает комнату ${data.roomId}`,
    );

    const room = this.groupRooms.get(data.roomId);
    if (!room) return;

    // Удаляем участника
    room.participants = room.participants.filter((p) => p !== data.userId);

    // Если комната пуста - удаляем её
    if (room.participants.length === 0) {
      this.groupRooms.delete(data.roomId);
      this.logger.log(`🗑️ Комната ${data.roomId} удалена (пустая)`);
    } else {
      this.groupRooms.set(data.roomId, room);

      // Уведомляем остальных участников
      room.participants.forEach((participantId) => {
        const participantSocketId = this.connectedUsers.get(participantId);
        if (participantSocketId) {
          this.server.to(participantSocketId).emit("room_participant_left", {
            participant: data.userId,
          });
        }
      });
    }

    this.logger.log(
      `👋 Пользователь ${data.userId} покинул комнату ${data.roomId}`,
    );
  }

  @SubscribeMessage("room_closed")
  handleRoomClosed(@MessageBody() data: { roomId: string; creator: string }) {
    this.logger.log(
      `🔴 Закрытие комнаты ${data.roomId} создателем ${data.creator}`,
    );

    const room = this.groupRooms.get(data.roomId);
    if (!room) return;

    // Уведомляем всех участников о закрытии
    room.participants.forEach((participantId) => {
      const participantSocketId = this.connectedUsers.get(participantId);
      if (participantSocketId) {
        this.server
          .to(participantSocketId)
          .emit("room_closed", { roomId: data.roomId });
      }
    });

    // Удаляем комнату
    this.groupRooms.delete(data.roomId);

    // Уведомляем всех об обновлении списка комнат
    this.broadcastAvailableRooms();

    this.logger.log(`🗑️ Комната ${data.roomId} закрыта и удалена`);
  }

  @SubscribeMessage("get_available_rooms")
  handleGetAvailableRooms(@ConnectedSocket() client: Socket) {
    const availableRooms = Array.from(this.groupRooms.values())
      .filter((room) => room.participants.length < room.maxParticipants)
      .map((room) => ({
        id: room.id,
        name: room.name,
        participants: room.participants.length,
        creator: room.creator,
      }));

    client.emit("available_rooms", { rooms: availableRooms });

    this.logger.log(
      `📋 Отправлен список доступных комнат: ${availableRooms.length} комнат`,
    );
  }

  private broadcastAvailableRooms() {
    const availableRooms = Array.from(this.groupRooms.values())
      .filter((room) => room.participants.length < room.maxParticipants)
      .map((room) => ({
        id: room.id,
        name: room.name,
        participants: room.participants.length,
        creator: room.creator,
      }));

    this.server.emit("available_rooms", { rooms: availableRooms });
    this.logger.log(
      `📢 Отправлен обновленный список комнат всем пользователям`,
    );
  }

  // === ПРИГЛАШЕНИЯ В ГРУППОВЫЕ КОМНАТЫ ===

  @SubscribeMessage("invite_to_room")
  handleInviteToRoom(
    @MessageBody()
    data: {
      roomId: string;
      invitedUserId: string;
      inviterUserId: string;
      inviterName: string;
      roomName: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(
      `📧 Приглашение в комнату ${data.roomId}: ${data.inviterUserId} → ${data.invitedUserId}`,
    );

    const room = this.groupRooms.get(data.roomId);
    if (!room) {
      client.emit("invite_failed", { reason: "Комната не найдена" });
      return;
    }

    if (room.participants.length >= room.maxParticipants) {
      client.emit("invite_failed", { reason: "Комната переполнена" });
      return;
    }

    if (room.participants.includes(data.invitedUserId)) {
      client.emit("invite_failed", { reason: "Пользователь уже в комнате" });
      return;
    }

    // Отправляем приглашение приглашаемому пользователю
    const invitedSocketId = this.connectedUsers.get(data.invitedUserId);
    if (invitedSocketId) {
      this.server.to(invitedSocketId).emit("room_invitation", {
        roomId: data.roomId,
        roomName: data.roomName,
        inviterUserId: data.inviterUserId,
        inviterName: data.inviterName,
      });

      this.logger.log(
        `✅ Приглашение отправлено пользователю ${data.invitedUserId}`,
      );
    } else {
      client.emit("invite_failed", { reason: "Пользователь не в сети" });
      this.logger.warn(`❌ Пользователь ${data.invitedUserId} не в сети`);
    }
  }

  @SubscribeMessage("invitation_declined")
  handleInvitationDeclined(
    @MessageBody()
    data: {
      roomId: string;
      inviterUserId: string;
      declinedUserId: string;
    },
  ) {
    this.logger.log(
      `❌ Приглашение отклонено: ${data.declinedUserId} отклонил приглашение от ${data.inviterUserId}`,
    );

    // Уведомляем пригласившего об отклонении
    const inviterSocketId = this.connectedUsers.get(data.inviterUserId);
    if (inviterSocketId) {
      this.server.to(inviterSocketId).emit("invitation_declined", {
        roomId: data.roomId,
        declinedUserId: data.declinedUserId,
      });
    }
  }

  // === ПРИГЛАШЕНИЯ В КЛАССЫ ===

  @SubscribeMessage("class_invite")
  async handleClassInvite(
    @MessageBody()
    data: {
      to: string;
      from: string;
      classData: {
        id: string;
        name: string;
        level: string;
        description: string;
        teacherName: string;
      };
    },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(
      `📚 Приглашение в класс "${data.classData.name}": ${data.from} → ${data.to}`,
    );

    // Получаем реальное имя преподавателя из auth-service
    let teacherName = data.classData.teacherName;
    try {
      // TODO: Добавить AuthClient в WebSocket gateway для получения имени преподавателя
      // Пока используем переданное имя или дефолтное
      this.logger.log(`[WebSocketGateway] Using teacher name: ${teacherName}`);
    } catch (error) {
      this.logger.warn(`[WebSocketGateway] Error getting teacher name: ${error.message}`);
      teacherName = 'Professeur';
    }

    const targetSocketId = this.connectedUsers.get(data.to);

    if (targetSocketId) {
      this.server.to(targetSocketId).emit("class_invitation", {
        classId: data.classData.id,
        className: data.classData.name,
        classLevel: data.classData.level,
        classDescription: data.classData.description,
        teacherId: data.from,
        teacherName: teacherName,
      });

      this.logger.log(`✅ Приглашение в класс отправлено пользователю ${data.to}`);
    } else {
      client.emit("class_invite_failed", {
        reason: "user_offline",
        targetUser: data.to,
      });

      this.logger.warn(`❌ Пользователь ${data.to} не в сети`);
    }
  }

  @SubscribeMessage("class_accept")
  handleClassAccept(
    @MessageBody()
    data: {
      to: string;
      from: string;
      classId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(
      `✅ Пользователь ${data.from} принял приглашение в класс ${data.classId}`,
    );

    const teacherSocketId = this.connectedUsers.get(data.to);
    if (teacherSocketId) {
      this.server.to(teacherSocketId).emit("class_invitation_accepted", {
        classId: data.classId,
        studentId: data.from,
      });

      this.logger.log(`📢 Преподаватель ${data.to} уведомлен о принятии приглашения`);
    }
  }

  @SubscribeMessage("class_reject")
  handleClassReject(
    @MessageBody()
    data: {
      to: string;
      from: string;
      classId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(
      `❌ Пользователь ${data.from} отклонил приглашение в класс ${data.classId}`,
    );

    const teacherSocketId = this.connectedUsers.get(data.to);
    if (teacherSocketId) {
      this.server.to(teacherSocketId).emit("class_invitation_rejected", {
        classId: data.classId,
        studentId: data.from,
      });

      this.logger.log(`📢 Преподаватель ${data.to} уведомлен об отклонении приглашения`);
    }
  }

  // === ПРИГЛАШЕНИЯ В УРОКИ ===

  @SubscribeMessage("invite_to_lesson")
  handleInviteToLesson(
    @MessageBody()
    data: {
      classId: string;
      studentIds: string[];
      teacherId: string;
      lessonName: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(
      `📚 Приглашение в урок "${data.lessonName}": ${data.teacherId} → ${data.studentIds.join(', ')}`,
    );

    // Отправляем приглашения каждому студенту
    data.studentIds.forEach(studentId => {
      const studentSocketId = this.connectedUsers.get(studentId);
      if (studentSocketId) {
        this.server.to(studentSocketId).emit("lesson_invitation", {
          classId: data.classId,
          lessonName: data.lessonName,
          teacherId: data.teacherId,
          teacherName: "Преподаватель", // Можно получить из базы данных
        });

        this.logger.log(
          `✅ Приглашение в урок отправлено студенту ${studentId}`,
        );
      } else {
        this.logger.warn(`❌ Студент ${studentId} не в сети`);
        client.emit("invite_failed", { 
          reason: `Студент ${studentId} не в сети`,
          studentId: studentId
        });
      }
    });

    // Уведомляем преподавателя о статусе приглашений
    client.emit("lesson_invitations_sent", {
      totalSent: data.studentIds.filter(id => this.connectedUsers.has(id)).length,
      totalFailed: data.studentIds.filter(id => !this.connectedUsers.has(id)).length,
      failedStudents: data.studentIds.filter(id => !this.connectedUsers.has(id))
    });
  }

  @SubscribeMessage("accept_lesson_invitation")
  handleAcceptLessonInvitation(
    @MessageBody()
    data: {
      classId: string;
      teacherId: string;
      studentId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(
      `✅ Студент ${data.studentId} принял приглашение в урок ${data.classId}`,
    );

    // Уведомляем преподавателя о принятии приглашения
    const teacherSocketId = this.connectedUsers.get(data.teacherId);
    if (teacherSocketId) {
      this.server.to(teacherSocketId).emit("lesson_invitation_accepted", {
        classId: data.classId,
        studentId: data.studentId,
        studentName: "Студент", // Можно получить из базы данных
      });
    }
  }

  @SubscribeMessage("reject_lesson_invitation")
  handleRejectLessonInvitation(
    @MessageBody()
    data: {
      classId: string;
      teacherId: string;
      studentId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(
      `❌ Студент ${data.studentId} отклонил приглашение в урок ${data.classId}`,
    );

    // Уведомляем преподавателя об отклонении приглашения
    const teacherSocketId = this.connectedUsers.get(data.teacherId);
    if (teacherSocketId) {
      this.server.to(teacherSocketId).emit("lesson_invitation_rejected", {
        classId: data.classId,
        studentId: data.studentId,
        studentName: "Студент", // Можно получить из базы данных
      });
    }
  }

  @SubscribeMessage("remove_from_room")
  handleRemoveFromRoom(
    @MessageBody()
    data: {
      roomId: string;
      removedUserId: string;
      removerUserId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(
      `🚫 Исключение из комнаты ${data.roomId}: ${data.removerUserId} исключает ${data.removedUserId}`,
    );

    const room = this.groupRooms.get(data.roomId);
    if (!room) return;

    // Проверяем права (только создатель может исключать)
    if (room.creator !== data.removerUserId) {
      client.emit("remove_failed", { reason: "Недостаточно прав" });
      return;
    }

    // Удаляем участника
    room.participants = room.participants.filter(
      (p) => p !== data.removedUserId,
    );
    this.groupRooms.set(data.roomId, room);

    // Уведомляем исключенного пользователя
    const removedSocketId = this.connectedUsers.get(data.removedUserId);
    if (removedSocketId) {
      this.server.to(removedSocketId).emit("removed_from_room", {
        roomId: data.roomId,
        removerUserId: data.removerUserId,
      });
    }

    // Уведомляем остальных участников об исключении
    room.participants.forEach((participantId) => {
      const participantSocketId = this.connectedUsers.get(participantId);
      if (participantSocketId) {
        this.server.to(participantSocketId).emit("room_participant_left", {
          participant: data.removedUserId,
        });
      }
    });

    this.logger.log(
      `✅ Пользователь ${data.removedUserId} исключен из комнаты ${data.roomId}`,
    );
  }
}
